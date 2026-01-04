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
    required: true,
    index: true
  },

  room: {
    type: String,
    required: true,
    index: true
  },

  text: {
    type: String,
    required: true
  },

  replyTo: ReplySchema,

  /**
   * 🔥 SOURCE OF TRUTH
   * kis-kis ne read kiya
   */
  readBy: {
    type: [String],
    default: [],
    index: true
  },

  /**
   * ⚠️ DERIVED FIELD (UI ONLY)
   * server kabhi trust nahi karega isko
   */
  status: {
    type: String,
    enum: ["delivered", "read"],
    default: "delivered"
  },

  created: {
    type: Date,
    default: Date.now,
    index: true
  }
});

/**
 * 🔥 AUTO SYNC STATUS (safety net)
 * agar kisi ne readBy me add hua → status = read
 */
MessageSchema.pre("save", function (next) {
  if (Array.isArray(this.readBy) && this.readBy.length > 0) {
    this.status = "read";
  }
  next();
});

module.exports = mongoose.model("Message", MessageSchema);
