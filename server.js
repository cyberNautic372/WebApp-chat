const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Message = require("./models/Message");
const User = require("./models/User");

mongoose.connect(process.env.MONGO_URL);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

/**
 * room => Set(users)
 */
const onlineUsers = new Map();

/**
 * Store last seen times
 */
const lastSeen = new Map(); // username -> timestamp

/* ---------- API ROUTES ---------- */
app.post('/api/user-info', async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.json({ clearedRooms: {} });
    }
    
    res.json({
      clearedRooms: user.clearedRooms || {}
    });
  } catch (err) {
    console.error("Error fetching user info:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

io.on("connection", socket => {

  /* ---------- JOIN ---------- */
  socket.on("join", async ({ user, room }) => {
    socket.user = user;
    socket.room = room;
    socket.join(room);

    // Update last seen to current time
    lastSeen.set(user, Date.now());
    
    // Update user's last seen in database
    await User.findOneAndUpdate(
      { username: user },
      { 
        $set: { lastSeen: Date.now() },
        $setOnInsert: { username: user, password: null, clearedRooms: {} }
      },
      { upsert: true, new: true }
    );
    
    // Notify others about user's online status
    socket.to(room).emit("user:online", { user, lastSeen: null });

    if (!onlineUsers.has(room)) {
      onlineUsers.set(room, new Set());
    }
    onlineUsers.get(room).add(user);

    const history = await Message.find({ room })
      .sort({ created: 1 })
      .limit(100);

    socket.emit("history", history);

    // 🔥 WhatsApp behavior:
    // user comes online → all unread become read
    const unread = await Message.find({
      room,
      user: { $ne: user },
      readBy: { $ne: user }
    });

    for (const m of unread) {
      m.readBy.push(user);
      m.status = "read";
      await m.save();

      io.to(room).emit("msg:read", { id: m._id });
    }
  });

  /* ---------- SEND MESSAGE ---------- */
  socket.on("msg", async payload => {
    if (!socket.user || !socket.room) return;

    const msg = await Message.create({
      user: socket.user,
      room: socket.room,
      text: payload.text,
      replyTo: payload.replyTo || null,
      readBy: [],
      status: "delivered"
    });

    io.to(socket.room).emit("msg", msg);

    // 🔥 if someone else already online → instantly read
    const users = onlineUsers.get(socket.room) || new Set();
    if (users.size > 1) {
      msg.readBy = [...users].filter(u => u !== socket.user);
      msg.status = "read";
      await msg.save();

      io.to(socket.room).emit("msg:read", { id: msg._id });
    }
  });

  /* ---------- READ RECEIPT ---------- */
  socket.on("msg:read", async id => {
    if (!socket.user || !socket.room) return;

    const m = await Message.findById(id);
    if (!m) return;

    if (!m.readBy.includes(socket.user)) {
      m.readBy.push(socket.user);
      m.status = "read";
      await m.save();

      io.to(socket.room).emit("msg:read", { id: m._id });
    }
  });

  /* ---------- DISCONNECT ---------- */
  socket.on("disconnect", async () => {
    const { room, user } = socket;
    if (!room || !user) return;

    // Update last seen
    const now = Date.now();
    lastSeen.set(user, now);
    
    // Update in database
    await User.findOneAndUpdate(
      { username: user },
      { $set: { lastSeen: now } },
      { upsert: true }
    );
    
    // Notify others about user's offline status
    socket.to(room).emit("user:offline", { 
      user, 
      lastSeen: now 
    });

    const set = onlineUsers.get(room);
    if (set) {
      set.delete(user);
      if (set.size === 0) onlineUsers.delete(room);
    }
  });

  /* ---------- TYPING ---------- */
  socket.on("typing:start", () => {
    socket.to(socket.room).emit("typing:start", socket.user);
  });

  socket.on("typing:stop", () => {
    socket.to(socket.room).emit("typing:stop", socket.user);
  });

  /* ---------- CLEAR HISTORY (user-specific) ---------- */
  socket.on("clear:history", async () => {
    if (!socket.user || !socket.room) return;
    
    // Store cleared history timestamp for this user
    try {
      await User.findOneAndUpdate(
        { username: socket.user },
        { 
          $set: { [`clearedRooms.${socket.room}`]: Date.now() },
          $setOnInsert: { username: socket.user, password: null, lastSeen: Date.now() }
        },
        { upsert: true, new: true }
      );
      
      socket.emit("clear:complete");
    } catch (err) {
      console.error("Error saving clear history:", err);
    }
  });

  /* ---------- GET LAST SEEN ---------- */
  socket.on("lastseen:request", async ({ user }) => {
    try {
      // Check if online
      const isOnline = [...onlineUsers.values()].some(set => set.has(user));
      
      if (isOnline) {
        socket.emit("lastseen:response", {
          user,
          timestamp: null,
          isOnline: true
        });
      } else {
        // Get from database
        const userRecord = await User.findOne({ username: user });
        if (userRecord && userRecord.lastSeen) {
          socket.emit("lastseen:response", {
            user,
            timestamp: userRecord.lastSeen,
            isOnline: false
          });
        } else if (lastSeen.has(user)) {
          // Fallback to memory cache
          socket.emit("lastseen:response", {
            user,
            timestamp: lastSeen.get(user),
            isOnline: false
          });
        }
      }
    } catch (err) {
      console.error("Error getting last seen:", err);
    }
  });
});

const PORT = process.env.PORT || 7736;
server.listen(PORT, "0.0.0.0", () =>
  console.log("Cyber IRC running on", PORT)
);
