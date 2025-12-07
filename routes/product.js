import express from "express";
import Product from "../models/Product.js";
import { verifyToken } from "../index.js";

const router = express.Router();

router.post("/add", async (req,res)=>{
  const u = verifyToken(req);
  if(!u || (u.role!=="OWNER" && u.role!=="OWNER_MASTER")) return res.json({status:"error"});
  await Product.create(req.body);
  res.json({status:"success"});
});

router.get("/list", async (req,res)=>{
  const list = await Product.find();
  res.json(list);
});

router.post("/toggle", async (req,res)=>{
  const u = verifyToken(req);
  if(!u || (u.role!=="OWNER" && u.role!=="OWNER_MASTER")) return res.json({status:"error"});
  const p = await Product.findOne({ name:req.body.name });
  if(!p) return res.json({status:"error"});
  p.disabled = !p.disabled;
  await p.save();
  res.json({status:"success"});
});

router.post("/delete", async (req,res)=>{
  const u = verifyToken(req);
  if(!u || u.role!=="OWNER_MASTER") return res.json({status:"error"});
  await Product.deleteOne({ name:req.body.name });
  res.json({status:"success"});
});

export default router;
