import express from "express";
import User from "../models/User.js";
import { verifyToken } from "../index.js";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

const router = express.Router();

router.get("/me", async (req,res)=>{
  const u = verifyToken(req);
  if(!u) return res.json({});
  const user = await User.findById(u.id);
  res.json({ username:user.username, role:user.role, status:user.status, has2FA:user.has2FA, discord:user.discord });
});

router.post("/enable-2fa", async (req,res)=>{
  const u = verifyToken(req);
  if(!u) return res.json({status:"error"});

  const user = await User.findById(u.id);
  const secret = speakeasy.generateSecret({ length:20, name:`GLOM-${user.username}` });
  user.secret2FA = secret.base32;
  user.has2FA = true;
  await user.save();

  const otpauth = secret.otpauth_url;
  const dataUrl = await QRCode.toDataURL(otpauth);
  res.json({ status:"success", qr:dataUrl, secret:secret.base32 });
});

router.post("/disable-2fa", async (req,res)=>{
  const u = verifyToken(req);
  if(!u) return res.json({status:"error"});
  const user = await User.findById(u.id);
  user.has2FA = false;
  user.secret2FA = null;
  await user.save();
  res.json({status:"success"});
});

export default router;
