const jwt = require("jsonwebtoken");
const db = require("../config/db");

async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentication required. Send Authorization: Bearer <token>." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await db.query(
      "SELECT id, name, email, role, hospital_id FROM users WHERE id = $1",
      [payload.sub]
    );
    if (!result.rowCount) return res.status(401).json({ error: "User account no longer exists." });
    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    next(err);
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}

function canAccessHospital(req, res, next) {
  if (req.user.role === "admin" || String(req.user.hospital_id) === String(req.params.hospitalId || req.params.id)) {
    return next();
  }
  return res.status(403).json({ error: "You can only manage your assigned hospital." });
}

module.exports = { authenticate, allowRoles, canAccessHospital };
