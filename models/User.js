import mongoose from "mongoose";

const discordSchema = new mongoose.Schema({
  id: { type: String, default: null },
  username: { type: String, default: null },
  avatar: { type: String, default: null }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, default: "PANEL" }, // OWNER_MASTER, OWNER, SOURCE, PANEL
  productsAllowed: { type: [String], default: [] },
  has2FA: { type: Boolean, default: false },
  secret2FA: { type: String, default: null },
  discord: { type: discordSchema, default: () => ({}) },
  status: { type: String, default: "Active" }, // Active, Suspended, Banned
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
