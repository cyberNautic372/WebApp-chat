const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Message = require("./models/Message");

mongoose.connect(process.env.MONGO_URL);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

io.on("connection", socket => {

  socket.on("join", async ({ user, room }) => {
    socket.user = user;
    socket.room = room;
    socket.join(room);

    const history = await Message
      .find({ room })
      .sort({ created: 1 })
      .limit(100);

    socket.emit("history", history);
  });

  socket.on("msg", async payload => {
    if (!socket.user || !socket.room) return;

    const msg = await Message.create({
      user: socket.user,
      room: socket.room,
      text: payload.text,
      replyTo: payload.replyTo || null,
      created: new Date()
    });

    io.to(socket.room).emit("msg", msg);
  });

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
