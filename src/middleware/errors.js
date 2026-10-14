function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.code === "23505") return res.status(409).json({ error: "A record with that unique value already exists." });
  if (err.code === "23503") return res.status(400).json({ error: "Referenced record does not exist." });
  if (err.code === "23514" || err.code === "22P02" || err.code === "22023") {
    return res.status(400).json({ error: "Invalid value supplied." });
  }
  res.status(500).json({
    error: "Internal server error",
    ...(process.env.NODE_ENV !== "production" ? { detail: err.message } : {})
  });
}

module.exports = { notFound, errorHandler };
