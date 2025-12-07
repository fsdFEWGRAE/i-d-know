import express from "express";
import User from "../models/User.js";
import bcrypt from "bcrypt";
import { verifyToken } from "../index.js";

const router = express.Router();

router.post("/add", async (req,res)=>{
  const u = verifyToken(req);
  if(!u || (u.role!=="OWNER" && u.role!=="OWNER_MASTER")) return res.json({status:"error"});
  const { username, password, product } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await User.create({
    username,
    password: hash,
    role:"SOURCE",
    productsAllowed:[product]
  });
  res.json({status:"success"});
});

router.get("/list", async (req,res)=>{
  const u = verifyToken(req);
  if(!u) return res.json([]);
  const list = await User.find({ role:"SOURCE" });
  res.json(list);
});

router.post("/toggle", async (req,res)=>{
  const u = verifyToken(req);
  if(!u || (u.role==="PANEL")) return res.json({status:"error"});
  const s = await User.findOne({ username:req.body.username });
  if(!s) return res.json({status:"error"});
  s.status = s.status==="Suspended" ? "Active" : "Suspended";
  await s.save();
  res.json({status:"success"});
});

router.post("/delete", async (req,res)=>{
  const u = verifyToken(req);
  if(!u || u.role!=="OWNER_MASTER") return res.json({status:"error"});
  await User.deleteOne({ username:req.body.username });
  res.json({status:"success"});
});

export default router;
