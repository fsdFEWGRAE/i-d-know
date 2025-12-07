import mongoose from "mongoose";

const keySchema = new mongoose.Schema({
  key: { type: String, unique: true },
  product: String,
  ownerUser: String, // who created (username)
  createdByType: String, // OWNER, SOURCE, PANEL
  status: { type: String, default: "Active" }, // Active, Suspended, Banned, Expired
  expiresAt: { type: Date, default: null },
  hwid: { type: String, default: "" },
  usedCount: { type: Number, default: 0 },
  lastUsed: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Key", keySchema);
