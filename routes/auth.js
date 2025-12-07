import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import speakeasy from "speakeasy";
import fetch from "node-fetch";
import User from "../models/User.js";
import Log from "../models/Log.js";
import { emitLog } from "../index.js";

const router = express.Router();

// Helper: create token
function createToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

// Normal login
router.post("/login", async (req, res) => {
  const { username, password, code2fa } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";

  const user = await User.findOne({ username });
  if (!user) {
    const log = await Log.create({
      type: "LOGIN",
      user: username,
      action: "LOGIN_FAIL_USER",
      ip,
      status: "FAIL",
      message: "User not found"
    });
    emitLog(log);
    return res.json({ status: "error", message: "User Not Found" });
  }

  if (user.status !== "Active") {
    const log = await Log.create({
      type: "LOGIN",
      user: username,
      action: "LOGIN_FAIL_STATUS",
      ip,
      status: "FAIL",
      message: "User status not active"
    });
    emitLog(log);
    return res.json({ status: "error", message: "Account not active" });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    const log = await Log.create({
      type: "LOGIN",
      user: username,
      action: "LOGIN_FAIL_PASSWORD",
      ip,
      status: "FAIL",
      message: "Wrong password"
    });
    emitLog(log);
    return res.json({ status: "error", message: "Wrong Password" });
  }

  // 2FA check
  if (user.has2FA) {
    if (!code2fa) {
      return res.json({ status: "need2fa" });
    }
    const verified = speakeasy.totp.verify({
      secret: user.secret2FA,
      encoding: "base32",
      token: code2fa
    });
    if (!verified) {
      const log = await Log.create({
        type: "LOGIN",
        user: username,
        action: "LOGIN_FAIL_2FA",
        ip,
        status: "FAIL",
        message: "Invalid 2FA"
      });
      emitLog(log);
      return res.json({ status: "error", message: "Invalid 2FA" });
    }
  }

  const token = createToken(user);
  const log = await Log.create({
    type: "LOGIN",
    user: username,
    action: "LOGIN_SUCCESS",
    ip,
    status: "SUCCESS",
    message: "Login success"
  });
  emitLog(log);
  return res.json({ status: "success", token });
});

// Discord OAuth login -> only if linked
router.get("/auth/discord/callback", async (req, res) => {
  const { code } = req.query;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";

  try {
    const params = new URLSearchParams();
    params.append("client_id", process.env.DISCORD_CLIENT_ID);
    params.append("client_secret", process.env.DISCORD_CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", process.env.DISCORD_REDIRECT_URI);
    params.append("scope", "identify");

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      body: params,
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    const tokenJson = await tokenRes.json();

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` }
    });
    const discordUser = await userRes.json();

    const user = await User.findOne({ "discord.id": discordUser.id });

    if (!user) {
      const log = await Log.create({
        type: "DISCORD_LOGIN",
        discord: discordUser.id,
        action: "DISCORD_NOT_LINKED",
        ip,
        status: "FAIL",
        message: "Discord login failed: Not linked to any GLOM Panel account."
      });
      emitLog(log);
      // redirect to login with message param
      return res.redirect("/login?discord=not_linked");
    }

    if (user.status !== "Active") {
      const log = await Log.create({
        type: "DISCORD_LOGIN",
        user: user.username,
        discord: discordUser.id,
        action: "DISCORD_LOGIN_STATUS_FAIL",
        ip,
        status: "FAIL",
        message: "Account not active"
      });
      emitLog(log);
      return res.redirect("/login?discord=blocked");
    }

    const token = createToken(user);
    const log = await Log.create({
      type: "DISCORD_LOGIN",
      user: user.username,
      discord: discordUser.id,
      action: "DISCORD_LOGIN_SUCCESS",
      ip,
      status: "SUCCESS",
      message: "Discord login success"
    });
    emitLog(log);
    // send small html page that sets localStorage then redirect
    return res.send(`
      <script>
        localStorage.setItem("glom_token", "${token}");
        window.location.href = "/dashboard";
      </script>
    `);
  } catch (e) {
    console.error("Discord callback error:", e);
    return res.redirect("/login?discord=error");
  }
});

export default router;
