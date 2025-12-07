import mongoose from "mongoose";

const logSchema = new mongoose.Schema({
  type: String,          // LOGIN, API, HWID, DISCORD, KEY, SECURITY
  user: String,          // username
  discord: String,       // discord id
  action: String,        // short type: LOGIN_SUCCESS, LOGIN_FAIL, API_SUCCESS...
  product: String,
  keyUsed: String,
  hwid: String,
  ip: String,
  status: String,        // SUCCESS / FAIL / INFO / WARN
  message: String,
  riskScore: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Log", logSchema);
