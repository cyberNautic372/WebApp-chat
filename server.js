const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const mongoose=require("mongoose");
const User=require("./models/User");
const Message=require("./models/Message");
const Room=require("./models/Room");
const bcrypt=require("bcrypt");

mongoose.connect(process.env.MONGO_URL);

const app=express();
const server=http.createServer(app);
const io=new Server(server);

app.use(express.json());
app.use(express.static("public"));

app.post("/register",async(req,res)=>{
 const hash=await bcrypt.hash(req.body.password,10);
 await User.create({username:req.body.username,password:hash});
 res.sendStatus(201);
});

app.post("/login",async(req,res)=>{
 const u=await User.findOne({username:req.body.username});
 if(!u||!await bcrypt.compare(req.body.password,u.password)) return res.sendStatus(401);
 res.json({ok:true});
});

io.on("connection",socket=>{
 socket.on("join",async({user,room})=>{
  const r=await Room.findOne({name:room});
  if(r?.private && !r.members.includes(user)) return;
  socket.join(room);
  socket.user=user;
  socket.room=room;
  const msgs=await Message.find({room}).limit(50);
  socket.emit("history",msgs);
 });

 socket.on("msg",async text=>{
  const m=await Message.create({user:socket.user,room:socket.room,text});
  io.to(socket.room).emit("msg",m);
 });
});

server.listen(7736);
