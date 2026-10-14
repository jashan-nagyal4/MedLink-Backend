const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { authenticate, allowRoles } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const result = await db.query(
      "SELECT id, name, email, password_hash, role, hospital_id FROM users WHERE LOWER(email) = LOWER($1)",
      [email.trim()]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const token = jwt.sign({ sub: String(user.id), role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h"
    });
    res.json({
      message: "Login successful",
      token,
      tokenType: "Bearer",
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      user: { id: user.id, name: user.name, email: user.email, role: user.role, hospitalId: user.hospital_id }
    });
  } catch (err) { next(err); }
});

router.get("/me", authenticate, (req, res) => res.json({ user: req.user }));

// Only an admin can create hospital staff accounts. Public registration is intentionally disabled.
router.post("/staff", authenticate, allowRoles("admin"), async (req, res, next) => {
  try {
    const { name, email, password, hospitalId } = req.body || {};
    if (!name || !email || typeof password !== "string" || password.length < 12 || !hospitalId) {
      return res.status(400).json({ error: "name, email, hospitalId and a password of at least 12 characters are required." });
    }
    const hospital = await db.query("SELECT id FROM hospitals WHERE id = $1", [hospitalId]);
    if (!hospital.rowCount) return res.status(400).json({ error: "Hospital not found." });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role, hospital_id)
       VALUES ($1, LOWER($2), $3, 'hospital_staff', $4)
       RETURNING id, name, email, role, hospital_id`,
      [String(name).trim(), String(email).trim(), passwordHash, hospitalId]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
