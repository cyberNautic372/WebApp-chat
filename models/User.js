const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    index: true,
    required: true
  },
  password: String,
  clearedRooms: {
    type: Map,
    of: Date,
    default: {}
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", UserSchema);
