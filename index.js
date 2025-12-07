import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";

import User from "./models/User.js";
import Key from "./models/Key.js";
import Product from "./models/Product.js";
import APIroute from "./models/APIroute.js";
import Log from "./models/Log.js";

import productRoute from "./routes/product.js";
import sourcesRoute from "./routes/sources.js";
import panelsRoute from "./routes/panels.js";
import createSystem from "./routes/createSystem.js";
import apiManagerRoute from "./routes/apiManager.js";
import keysRoute from "./routes/keys.js";
import hwidResetRoute from "./routes/hwidReset.js";
import settingsRoute from "./routes/settings.js";
import logsRoute from "./routes/logs.js";
import discordRoute from "./routes/discord.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== DB ======
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10
}).then(()=> console.log("MongoDB Connected ✔"))
  .catch(err=> console.error("Mongo error", err));

// ====== MIDDLEWARE ======
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Rate limit basic (HTTP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(apiLimiter);

// ==== JWT Helpers ====
function createToken(user){
  return jwt.sign(
    { id:user._id, username:user.username, role:user.role },
    process.env.JWT_SECRET || "GLOM_AUTH_TOKEN",
    { expiresIn: "30d" }
  );
}

export function verifyToken(req){
  try {
    const auth = req.headers.authorization || "";
    const token = auth.split(" ")[1];
    if(!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET || "GLOM_AUTH_TOKEN");
  } catch {
    return null;
  }
}

// Broadcast log to clients
export async function pushLog(obj){
  const log = await Log.create(obj);
  io.emit("log_event", {
    type: log.type,
    action: log.action,
    user: log.user,
    discord: log.discord,
    product: log.product,
    keyUsed: log.keyUsed,
    hwid: log.hwid,
    ip: log.ip,
    status: log.status,
    message: log.message,
    riskScore: log.riskScore,
    createdAt: log.createdAt
  });
}

// ====== VIEWS ======
app.get("/", (req,res)=> res.render("landing"));
app.get("/login", (req,res)=> res.render("login"));
app.get("/disclaimer", (req,res)=> res.render("disclaimer"));
app.get("/dashboard", (req,res)=> res.render("dashboard"));
app.get("/create", (req,res)=> res.render("create"));
app.get("/keys", (req,res)=> res.render("keys"));
app.get("/products", (req,res)=> res.render("products"));
app.get("/sources", (req,res)=> res.render("sources"));
app.get("/panels", (req,res)=> res.render("panels"));
app.get("/api", (req,res)=> res.render("api"));
app.get("/settings", (req,res)=> res.render("settings"));
app.get("/logs", (req,res)=> res.render("logs"));

// ====== LOGIN API (username/password + 2FA) ======
import speakeasy from "speakeasy";

app.post("/login", async (req,res)=>{
  const { username, password, code2fa } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const user = await User.findOne({ username });
  if(!user){
    await pushLog({ type:"LOGIN", user:username, ip, status:"FAIL", action:"LOGIN_FAIL", message:"User not found" });
    return res.json({ status:"error", message:"User Not Found" });
  }
  if(user.status === "Banned"){
    await pushLog({ type:"LOGIN", user:username, ip, status:"FAIL", action:"LOGIN_FAIL", message:"Banned user" });
    return res.json({ status:"error", message:"Account banned" });
  }
  if(user.status === "Suspended"){
    await pushLog({ type:"LOGIN", user:username, ip, status:"FAIL", action:"LOGIN_FAIL", message:"Suspended" });
    return res.json({ status:"error", message:"Account suspended" });
  }

  const match = await bcrypt.compare(password, user.password);
  if(!match){
    await pushLog({ type:"LOGIN", user:username, ip, status:"FAIL", action:"LOGIN_FAIL", message:"Wrong password" });
    return res.json({ status:"error", message:"Wrong Password" });
  }

  if(user.has2FA){
    if(!code2fa){
      return res.json({ status:"need2fa" });
    }
    const verified = speakeasy.totp.verify({
      secret: user.secret2FA,
      encoding: "base32",
      token: code2fa,
      window: 1
    });
    if(!verified){
      await pushLog({ type:"LOGIN", user:username, ip, status:"FAIL", action:"LOGIN_2FA_FAIL", message:"Wrong 2FA" });
      return res.json({ status:"error", message:"Invalid 2FA" });
    }
  }

  await pushLog({ type:"LOGIN", user:username, ip, status:"SUCCESS", action:"LOGIN_SUCCESS", message:"User logged in" });

  const token = createToken(user);
  res.json({ status:"success", token });
});

// ====== DASHBOARD STATS ======
app.get("/dashboard/stats", async (req,res)=>{
  try{
    const user = verifyToken(req);
    if(!user) return res.json({});

    const [products, keys, sources, panels, apiCount] = await Promise.all([
      Product.countDocuments(),
      Key.countDocuments(),
      User.countDocuments({ role:"SOURCE" }),
      User.countDocuments({ role:"PANEL" }),
      APIroute.countDocuments()
    ]);

    res.json({ role:user.role, products, keys, sources, panels, apiCount });
  } catch {
    res.json({});
  }
});

// ====== ROUTES (REST) ======
app.use("/product", productRoute);
app.use("/sources", sourcesRoute);
app.use("/panels", panelsRoute);
app.use("/create", createSystem);
app.use("/keys", keysRoute);
app.use("/hwid", hwidResetRoute);
app.use("/api-manager", apiManagerRoute);
app.use("/settings", settingsRoute);
app.use("/", logsRoute);
app.use("/", discordRoute);

// ====== API LOGIN (for loaders) ======
app.post("/:apiName/login", async (req,res)=>{
  const { apiName } = req.params;
  const { key, hwid } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  try{
    const api = await APIroute.findOne({ apiName, enabled:true });
    if(!api){
      await pushLog({ type:"API", ip, keyUsed:key, status:"FAIL", action:"API_FAIL", message:"API not found", product:null });
      return res.type("text/plain").send("ERROR");
    }

    const k = await Key.findOne({ key, product: api.product });
    if(!k){
      await pushLog({ type:"API", ip, keyUsed:key, status:"FAIL", action:"API_FAIL", message:"Key not found", product: api.product });
      return res.type("text/plain").send("ERROR");
    }

    if(k.status === "Banned"){
      await pushLog({ type:"API", ip, keyUsed:key, status:"FAIL", action:"API_FAIL", message:"Key banned", product: api.product });
      return res.type("text/plain").send("BANNED");
    }
    if(k.status === "Suspended"){
      await pushLog({ type:"API", ip, keyUsed:key, status:"FAIL", action:"API_FAIL", message:"Key suspended", product: api.product });
      return res.type("text/plain").send("PAUSED");
    }

    const now = new Date();
    if(k.expiresAt && k.expiresAt < now){
      k.status = "Expired";
      await k.save();
      await pushLog({ type:"API", ip, keyUsed:key, status:"FAIL", action:"API_FAIL", message:"Key expired", product: api.product });
      return res.type("text/plain").send("EXPIRED");
    }

    if(!k.hwid || k.hwid === ""){
      k.hwid = hwid || "";
      k.usedCount += 1;
      k.lastUsed = now;
      await k.save();
      await pushLog({ type:"API", ip, keyUsed:key, status:"SUCCESS", action:"API_SUCCESS", message:"First time bind HWID", product: api.product, hwid });
      return res.type("text/plain").send("SUCCESS");
    } else {
      if(!hwid || k.hwid !== hwid){
        await pushLog({ type:"API", ip, keyUsed:key, status:"FAIL", action:"API_FAIL", message:"HWID Mismatch", product: api.product, hwid });
        return res.type("text/plain").send("\u274c HWID Mismatch");
      }
    }

    k.usedCount += 1;
    k.lastUsed = now;
    await k.save();

    await pushLog({ type:"API", ip, keyUsed:key, status:"SUCCESS", action:"API_SUCCESS", message:"Key accepted", product: api.product, hwid });
    return res.type("text/plain").send("SUCCESS");
  } catch (err){
    console.error("Runtime API error:", err);
    await pushLog({ type:"API", ip, keyUsed:key, status:"FAIL", action:"API_FAIL", message:"Internal error", product:null });
    return res.type("text/plain").send("ERROR");
  }
});

// ====== SOCKET.IO ======
io.on("connection", (socket)=>{
  console.log("Client connected to logs socket");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>{
  console.log("GLOM Authorization FULL KILLER running on port " + PORT);
});
