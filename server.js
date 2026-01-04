const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Message = require("./models/Message");

mongoose.connect(process.env.MONGO_URL);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/**
 * room => Set(users)
 */
const onlineUsers = new Map();

io.on("connection", socket => {

  /* ---------- JOIN ---------- */
  socket.on("join", async ({ user, room }) => {
    socket.user = user;
    socket.room = room;
    socket.join(room);

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
  socket.on("disconnect", () => {
    const { room, user } = socket;
    if (!room || !user) return;

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
});

const PORT = process.env.PORT || 7736;
server.listen(PORT, "0.0.0.0", () =>
  console.log("Cyber IRC running on", PORT)
);
