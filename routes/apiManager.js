import express from "express";
import APIroute from "../models/APIroute.js";
import { verifyToken } from "../index.js";

const router = express.Router();

router.post("/create", async (req,res)=>{
  const u = verifyToken(req);
  if(!u || (u.role!=="OWNER" && u.role!=="OWNER_MASTER")) return res.json({status:"error"});
  const { apiName, product } = req.body;
  await APIroute.create({ apiName, product, createdBy:u.username });
  res.json({status:"success"});
});

router.get("/list", async (req,res)=>{
  const list = await APIroute.find();
  res.json(list);
});

router.post("/toggle", async (req,res)=>{
  const u = verifyToken(req);
  if(!u || (u.role!=="OWNER" && u.role!=="OWNER_MASTER")) return res.json({status:"error"});
  const a = await APIroute.findOne({ apiName:req.body.apiName });
  if(!a) return res.json({status:"error"});
  a.enabled = !a.enabled;
  await a.save();
  res.json({status:"success"});
});

export default router;
