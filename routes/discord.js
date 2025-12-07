import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { verifyToken, pushLog } from "../index.js";

const router = express.Router();

router.get("/settings/discord-status", async (req,res)=>{
  const u = verifyToken(req);
  if(!u) return res.json({linked:false});
  const user = await User.findById(u.id);
  if(user.discord && user.discord.id)
    return res.json({linked:true, username:user.discord.username});
  return res.json({linked:false});
});

router.post("/settings/unlink-discord", async (req,res)=>{
  const u = verifyToken(req);
  if(!u) return res.json({status:"error"});
  const user = await User.findById(u.id);
  user.discord = { id:null, username:null, avatar:null };
  await user.save();
  res.json({status:"success"});
});

router.get("/settings/link-discord", (req,res)=>{
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirect = encodeURIComponent(process.env.DISCORD_REDIRECT_URI);
  const authURL = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=identify`;
  res.redirect(authURL);
});

router.get("/auth/discord", async (req,res)=>{
  const { code, state } = req.query;
  try{
    const body = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type:"authorization_code",
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI
    });

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method:"POST",
      headers:{ "Content-Type":"application/x-www-form-urlencoded" },
      body
    });
    const tokenJSON = await tokenResponse.json();
    const userInfo = await fetch("https://discord.com/api/users/@me", {
      headers:{ "Authorization": `Bearer ${tokenJSON.access_token}` }
    });
    const discord = await userInfo.json();

    // هنا فيه حالتين: ربط أو تسجيل دخول
    if(state === "login"){
      const u = await User.findOne({ "discord.id": discord.id });
      if(!u){
        await pushLog({ type:"DISCORD", discord:discord.id, status:"FAIL", action:"DISCORD_LOGIN_FAIL", message:"Discord login failed: Not linked to any GLOM Panel account." });
        return res.render("login", { discordError:true });
      }
      if(u.status==="Banned"){
        await pushLog({ type:"DISCORD", discord:discord.id, user:u.username, status:"FAIL", action:"DISCORD_LOGIN_FAIL", message:"Banned account" });
        return res.render("login", { discordError:true });
      }
      const jwtToken = jwt.sign({ id:u._id, username:u.username, role:u.role }, process.env.JWT_SECRET || "GLOM_AUTH_TOKEN", { expiresIn:"30d" });
      await pushLog({ type:"DISCORD", discord:discord.id, user:u.username, status:"SUCCESS", action:"DISCORD_LOGIN_SUCCESS", message:"Discord login success" });
      const base = process.env.PANEL_BASE_URL || "/";
      return res.redirect(base + "/login?token=" + jwtToken);
    } else {
      // link to existing account: token in state
      const decoded = jwt.verify(state, process.env.JWT_SECRET || "GLOM_AUTH_TOKEN");
      const user = await User.findById(decoded.id);
      user.discord = {
        id: discord.id,
        username: discord.username,
        avatar: discord.avatar
      };
      await user.save();
      await pushLog({ type:"DISCORD", discord:discord.id, user:user.username, status:"SUCCESS", action:"DISCORD_LINK", message:"Discord linked" });
      const base = process.env.PANEL_BASE_URL || "/settings";
      return res.redirect(base + "/settings");
    }
  } catch (e){
    console.error(e);
    return res.redirect("/login");
  }
});

export default router;
