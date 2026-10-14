const express = require("express");
const db = require("../config/db");
const { authenticate, allowRoles } = require("../middleware/auth");
const { isPositiveInteger, isCoordinate } = require("../utils/validation");

const router = express.Router();
router.use(authenticate);

const hospitalSelect = `
 SELECT id, name, address, phone, email, operational_status,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude, created_at, updated_at
 FROM hospitals`;

router.get("/nearby", async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    const radius = req.query.radius === undefined ? 10000 : Number(req.query.radius);
    if (!isCoordinate(lat, -90, 90) || !isCoordinate(lng, -180, 180)) {
      return res.status(400).json({ error: "Valid lat (-90 to 90) and lng (-180 to 180) query parameters are required." });
    }
    if (!Number.isFinite(radius) || radius < 1 || radius > 200000) {
      return res.status(400).json({ error: "radius must be between 1 and 200000 metres." });
    }
    const result = await db.query(
      `SELECT h.id, h.name, h.address, h.phone, h.operational_status,
              ST_Y(h.location::geometry) AS latitude,
              ST_X(h.location::geometry) AS longitude,
              ROUND(ST_Distance(h.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric) AS distance_meters
       FROM hospitals h
       WHERE h.operational_status <> 'closed'
         AND ST_DWithin(h.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       ORDER BY ST_Distance(h.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
       LIMIT 100`,
      [Number(lng), Number(lat), radius]
    );
    res.json({ count: result.rowCount, radiusMeters: radius, hospitals: result.rows });
  } catch (err) { next(err); }
});

router.get("/", async (req, res, next) => {
  try {
    const result = await db.query(`${hospitalSelect} ORDER BY name LIMIT 500`);
    res.json({ count: result.rowCount, hospitals: result.rows });
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: "Invalid hospital id." });
    const result = await db.query(`${hospitalSelect} WHERE id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Hospital not found." });
    const [resources, specialists] = await Promise.all([
      db.query("SELECT * FROM hospital_resources WHERE hospital_id = $1 ORDER BY resource_type", [req.params.id]),
      db.query("SELECT * FROM hospital_specialists WHERE hospital_id = $1 ORDER BY specialty", [req.params.id])
    ]);
    res.json({ hospital: result.rows[0], resources: resources.rows, specialists: specialists.rows });
  } catch (err) { next(err); }
});

router.post("/", allowRoles("admin"), async (req, res, next) => {
  try {
    const { name, address, phone = null, email = null, latitude, longitude, operationalStatus = "operational" } = req.body || {};
    if (typeof name !== "string" || !name.trim() || typeof address !== "string" || !address.trim()) {
      return res.status(400).json({ error: "name and address are required." });
    }
    if (!isCoordinate(latitude, -90, 90) || !isCoordinate(longitude, -180, 180)) {
      return res.status(400).json({ error: "Valid latitude and longitude are required." });
    }
    if (!["operational", "limited", "closed"].includes(operationalStatus)) {
      return res.status(400).json({ error: "operationalStatus must be operational, limited, or closed." });
    }
    const result = await db.query(
      `INSERT INTO hospitals (name, address, phone, email, location, operational_status)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7)
       RETURNING id, name, address, phone, email, operational_status,
       ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude, created_at, updated_at`,
      [name.trim(), address.trim(), phone, email, Number(longitude), Number(latitude), operationalStatus]
    );
    res.status(201).json({ message: "Hospital created.", hospital: result.rows[0] });
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: "Invalid hospital id." });
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can edit hospital details." });
    }
    const current = await db.query("SELECT * FROM hospitals WHERE id = $1", [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: "Hospital not found." });
    const old = current.rows[0], b = req.body || {};
    const name = b.name === undefined ? old.name : b.name;
    const address = b.address === undefined ? old.address : b.address;
    const phone = b.phone === undefined ? old.phone : b.phone;
    const email = b.email === undefined ? old.email : b.email;
    const status = b.operationalStatus === undefined ? old.operational_status : b.operationalStatus;
    const lat = b.latitude === undefined ? Number((await db.query("SELECT ST_Y(location::geometry) AS v FROM hospitals WHERE id=$1", [req.params.id])).rows[0].v) : Number(b.latitude);
    const lng = b.longitude === undefined ? Number((await db.query("SELECT ST_X(location::geometry) AS v FROM hospitals WHERE id=$1", [req.params.id])).rows[0].v) : Number(b.longitude);
    if (typeof name !== "string" || !name.trim() || typeof address !== "string" || !address.trim() ||
        !isCoordinate(lat, -90, 90) || !isCoordinate(lng, -180, 180) ||
        !["operational", "limited", "closed"].includes(status)) {
      return res.status(400).json({ error: "Invalid hospital fields." });
    }
    const result = await db.query(
      `UPDATE hospitals SET name=$1, address=$2, phone=$3, email=$4,
       location=ST_SetSRID(ST_MakePoint($5,$6),4326)::geography,
       operational_status=$7, updated_at=NOW()
       WHERE id=$8
       RETURNING id,name,address,phone,email,operational_status,
       ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude, updated_at`,
      [name.trim(), address.trim(), phone, email, lng, lat, status, req.params.id]
    );
    res.json({ message: "Hospital updated.", hospital: result.rows[0] });
  } catch (err) { next(err); }
});

router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: "Invalid hospital id." });
    const result = await db.query("DELETE FROM hospitals WHERE id=$1 RETURNING id, name", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Hospital not found." });
    res.json({ message: "Hospital deleted.", hospital: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
