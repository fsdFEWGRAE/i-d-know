import express from "express";
import Key from "../models/Key.js";
import { verifyToken } from "../index.js";

const router = express.Router();

router.post("/reset", async (req,res)=>{
  const u = verifyToken(req);
  if(!u) return res.json({status:"error"});
  const { key } = req.body;
  const k = await Key.findOne({ key });
  if(!k) return res.json({status:"error"});
  if(u.role!=="OWNER" && u.role!=="OWNER_MASTER" && k.ownerUser!==u.username)
    return res.json({status:"error"});
  k.hwid="";
  await k.save();
  res.json({status:"success"});
});

export default router;
