import express from "express";
import Product from "../models/Product.js";
import jwt from "jsonwebtoken";

const router = express.Router();

function getUser(req) {
  try {
    const header = req.headers.authorization || "";
    const token = header.split(" ")[1];
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// list products as JSON
router.get("/list", async (req, res) => {
  const list = await Product.find();
  res.json(list);
});

// add product
router.post("/add", async (req, res) => {
  const u = getUser(req);
  if (!u || (u.role !== "OWNER" && u.role !== "OWNER_MASTER")) {
    return res.json({ status: "error", message: "No permission" });
  }
  await Product.create(req.body);
  res.json({ status: "success" });
});

// toggle disabled
router.post("/toggle", async (req, res) => {
  const u = getUser(req);
  if (!u || (u.role !== "OWNER" && u.role !== "OWNER_MASTER")) {
    return res.json({ status: "error" });
  }
  const { name } = req.body;
  const p = await Product.findOne({ name });
  if (!p) return res.json({ status: "error", message: "Not found" });
  p.disabled = !p.disabled;
  await p.save();
  res.json({ status: "success" });
});

// delete product
router.post("/delete", async (req, res) => {
  const u = getUser(req);
  if (!u || u.role !== "OWNER_MASTER") {
    return res.json({ status: "error", message: "Only MASTER" });
  }
  const { name } = req.body;
  await Product.deleteOne({ name });
  res.json({ status: "success" });
});

export default router;
