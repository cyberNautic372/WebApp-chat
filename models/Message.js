const mongoose = require("mongoose");

const ReplySchema = new mongoose.Schema(
  {
    messageId: mongoose.Schema.Types.ObjectId,
    user: String,
    text: String,
    created: Date
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true
  },

  room: {
    type: String,
    required: true
  },

  text: {
    type: String,
    required: true
  },

  replyTo: ReplySchema,

  // 🔥 WHO HAS READ THIS MESSAGE
  readBy: {
    type: [String],
    default: []
  },

  // UI helper (not source of truth)
  status: {
    type: String,
    enum: ["delivered", "read"],
    default: "delivered"
  },

  created: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Message", MessageSchema);

