const mongoose = require("mongoose");

const ReplySchema = new mongoose.Schema({
  messageId: mongoose.Schema.Types.ObjectId,
  user: String,
  text: String,
  created: Date
},{ _id:false });

const MessageSchema = new mongoose.Schema({
  user: { type:String, required:true },
  room: { type:String, required:true },
  text: { type:String, required:true },
  replyTo: ReplySchema,
  created: { type:Date, default:Date.now }
});

module.exports = mongoose.model("Message", MessageSchema);
