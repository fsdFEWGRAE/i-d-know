import express from "express";
import Key from "../models/Key.js";
import { verifyToken } from "../index.js";

const router = express.Router();

function randomKey(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function part(){ return Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join(""); }
  return `GLOM-${part()}-${part()}-${part()}`;
}

router.post("/generate", async (req,res)=>{
  const u = verifyToken(req);
  if(!u) return res.json({status:"error"});
  const { type, product, duration, quantity } = req.body;
  const list = [];
  const qty = parseInt(quantity || "1",10);
  const now = new Date();

  let ms = 0;
  if(duration==="1h") ms = 3600000;
  else if(duration==="1d") ms = 24*3600000;
  else if(duration==="7d") ms = 7*24*3600000;
  else if(duration==="30d") ms = 30*24*3600000;
  else if(duration==="lifetime") ms = 0;

  for(let i=0;i<qty;i++){
    const k = randomKey();
    const expiresAt = ms>0 ? new Date(now.getTime()+ms) : null;
    await Key.create({
      key:k,
      product,
      ownerUser:u.username,
      createdByType:u.role,
      expiresAt
    });
    list.push(k);
  }

  res.json({status:"success", keys:list});
});

export default router;
