const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { isPositiveInteger } = require("../utils/validation");

const router = express.Router();
router.use(authenticate);

function canManage(req, hospitalId) {
  return req.user.role === "admin" || String(req.user.hospital_id) === String(hospitalId);
}

router.get("/hospital/:hospitalId", async (req, res, next) => {
  try {
    if (!isPositiveInteger(req.params.hospitalId)) return res.status(400).json({ error: "Invalid hospital id." });
    const result = await db.query("SELECT * FROM hospital_specialists WHERE hospital_id=$1 ORDER BY specialty", [req.params.hospitalId]);
    res.json({ count: result.rowCount, specialists: result.rows });
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const { hospitalId, specialty, available = false, countAvailable = 0, dutyNotes = null } = req.body || {};
    if (!isPositiveInteger(hospitalId) || typeof specialty !== "string" || !specialty.trim() ||
        typeof available !== "boolean" || !Number.isInteger(countAvailable) || countAvailable < 0) {
      return res.status(400).json({ error: "Valid hospitalId, specialty, available and countAvailable are required." });
    }
    if (!canManage(req, hospitalId)) return res.status(403).json({ error: "You can only manage specialists for your assigned hospital." });
    const result = await db.query(
      `INSERT INTO hospital_specialists (hospital_id, specialty, available, count_available, duty_notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [hospitalId, specialty.trim(), available, countAvailable, dutyNotes]
    );
    res.status(201).json({ message: "Specialist record created.", specialist: result.rows[0] });
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: "Invalid specialist id." });
    const found = await db.query("SELECT * FROM hospital_specialists WHERE id=$1", [req.params.id]);
    if (!found.rowCount) return res.status(404).json({ error: "Specialist record not found." });
    const old = found.rows[0];
    if (!canManage(req, old.hospital_id)) return res.status(403).json({ error: "You can only manage specialists for your assigned hospital." });
    const b = req.body || {};
    const available = b.available === undefined ? old.available : b.available;
    const count = b.countAvailable === undefined ? old.count_available : b.countAvailable;
    const notes = b.dutyNotes === undefined ? old.duty_notes : b.dutyNotes;
    if (typeof available !== "boolean" || !Number.isInteger(count) || count < 0) {
      return res.status(400).json({ error: "available must be boolean and countAvailable must be a non-negative integer." });
    }
    const result = await db.query(
      "UPDATE hospital_specialists SET available=$1,count_available=$2,duty_notes=$3,updated_at=NOW() WHERE id=$4 RETURNING *",
      [available, count, notes, req.params.id]
    );
    res.json({ message: "Specialist record updated.", specialist: result.rows[0] });
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: "Invalid specialist id." });
    const found = await db.query("SELECT id, hospital_id FROM hospital_specialists WHERE id=$1", [req.params.id]);
    if (!found.rowCount) return res.status(404).json({ error: "Specialist record not found." });
    if (!canManage(req, found.rows[0].hospital_id)) return res.status(403).json({ error: "You can only manage specialists for your assigned hospital." });
    await db.query("DELETE FROM hospital_specialists WHERE id=$1", [req.params.id]);
    res.json({ message: "Specialist record deleted." });
  } catch (err) { next(err); }
});

module.exports = router;
