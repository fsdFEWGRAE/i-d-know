import mongoose from "mongoose";

const apiRouteSchema = new mongoose.Schema({
  apiName: { type: String, unique: true },
  product: String,
  enabled: { type: Boolean, default: true },
  createdBy: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("APIroute", apiRouteSchema);
