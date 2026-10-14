const express = require("express");
const db = require("../config/db");
const { authenticate, allowRoles } = require("../middleware/auth");
const { isPositiveInteger } = require("../utils/validation");

const router = express.Router();
router.use(authenticate);

function canManage(req, hospitalId) {
  return req.user.role === "admin" || String(req.user.hospital_id) === String(hospitalId);
}

router.get("/hospital/:hospitalId", async (req, res, next) => {
  try {
    const { hospitalId } = req.params;
    if (!isPositiveInteger(hospitalId)) return res.status(400).json({ error: "Invalid hospital id." });
    const result = await db.query("SELECT * FROM hospital_resources WHERE hospital_id=$1 ORDER BY resource_type", [hospitalId]);
    res.json({ count: result.rowCount, resources: result.rows });
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const { hospitalId, resourceType, totalQuantity, availableQuantity, status = "available", notes = null } = req.body || {};
    if (!isPositiveInteger(hospitalId) || typeof resourceType !== "string" || !resourceType.trim() ||
        !Number.isInteger(totalQuantity) || totalQuantity < 0 ||
        !Number.isInteger(availableQuantity) || availableQuantity < 0 || availableQuantity > totalQuantity ||
        !["available", "limited", "unavailable", "maintenance"].includes(status)) {
      return res.status(400).json({ error: "Valid hospitalId, resourceType, totalQuantity, availableQuantity and status are required." });
    }
    if (!canManage(req, hospitalId)) return res.status(403).json({ error: "You can only manage resources for your assigned hospital." });
    const result = await db.query(
      `INSERT INTO hospital_resources (hospital_id, resource_type, total_quantity, available_quantity, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [hospitalId, resourceType.trim(), totalQuantity, availableQuantity, status, notes]
    );
    res.status(201).json({ message: "Resource created.", resource: result.rows[0] });
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: "Invalid resource id." });
    const found = await db.query("SELECT * FROM hospital_resources WHERE id=$1", [req.params.id]);
    if (!found.rowCount) return res.status(404).json({ error: "Resource not found." });
    const old = found.rows[0];
    if (!canManage(req, old.hospital_id)) return res.status(403).json({ error: "You can only manage resources for your assigned hospital." });
    const b = req.body || {};
    const total = b.totalQuantity === undefined ? old.total_quantity : b.totalQuantity;
    const available = b.availableQuantity === undefined ? old.available_quantity : b.availableQuantity;
    const status = b.status === undefined ? old.status : b.status;
    const notes = b.notes === undefined ? old.notes : b.notes;
    if (!Number.isInteger(total) || total < 0 || !Number.isInteger(available) || available < 0 ||
        available > total || !["available", "limited", "unavailable", "maintenance"].includes(status)) {
      return res.status(400).json({ error: "Invalid quantity or status." });
    }
    const result = await db.query(
      `UPDATE hospital_resources SET total_quantity=$1, available_quantity=$2, status=$3, notes=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [total, available, status, notes, req.params.id]
    );
    res.json({ message: "Resource updated.", resource: result.rows[0] });
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: "Invalid resource id." });
    const found = await db.query("SELECT id, hospital_id FROM hospital_resources WHERE id=$1", [req.params.id]);
    if (!found.rowCount) return res.status(404).json({ error: "Resource not found." });
    if (!canManage(req, found.rows[0].hospital_id)) return res.status(403).json({ error: "You can only manage resources for your assigned hospital." });
    await db.query("DELETE FROM hospital_resources WHERE id=$1", [req.params.id]);
    res.json({ message: "Resource deleted." });
  } catch (err) { next(err); }
});

module.exports = router;
