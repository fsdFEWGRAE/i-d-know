import express from "express";
import Log from "../models/Log.js";
import { verifyToken } from "../index.js";

const router = express.Router();

router.get("/logs/list", async (req,res)=>{
  const u = verifyToken(req);
  if(!u || (u.role!=="OWNER" && u.role!=="OWNER_MASTER"))
    return res.json([]);

  const { type, status, user, ip } = req.query;
  const q = {};
  if(type) q.type = type;
  if(status) q.status = status;
  if(user) q.user = user;
  if(ip) q.ip = ip;
  const list = await Log.find(q).sort({createdAt:-1}).limit(300);
  res.json(list);
});

export default router;
