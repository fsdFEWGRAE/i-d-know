import express from "express";
import Key from "../models/Key.js";
import { verifyToken } from "../index.js";

const router = express.Router();

router.get("/list", async (req,res)=>{
  const u = verifyToken(req);
  if(!u) return res.json([]);
  let query = {};
  if(u.role==="PANEL" || u.role==="SOURCE") query.ownerUser = u.username;
  const list = await Key.find(query).sort({ createdAt:-1 }).limit(500);
  res.json(list);
});

router.post("/action", async (req,res)=>{
  const u = verifyToken(req);
  if(!u) return res.json({status:"error"});
  const { key, action } = req.body;
  const k = await Key.findOne({ key });
  if(!k) return res.json({status:"error"});

  if(action==="ban") k.status="Banned";
  else if(action==="suspend") k.status="Suspended";
  else if(action==="activate") k.status="Active";
  else if(action==="reset_hwid") k.hwid="";
  await k.save();

  res.json({status:"success"});
});

export default router;
