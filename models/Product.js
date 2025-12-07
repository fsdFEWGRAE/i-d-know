import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  creationType: { type: String, enum: ["KEY", "USERPASS"], default: "KEY" },
  apiName: { type: String, unique: true },
  defaultDuration: { type: String, default: "7d" }, // 1h, 1d, 7d, 30d, lifetime
  hwidLimit: { type: Number, default: 1 },
  resetLimit: { type: Number, default: 99 },
  allowSourceSell: { type: Boolean, default: true },
  allowPanelSell: { type: Boolean, default: true },
  allowPanelResetHWID: { type: Boolean, default: true },
  allowSourceResetHWID: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false }
});

export default mongoose.model("Product", productSchema);
