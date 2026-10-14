require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../src/config/db");

(async () => {
  try {
    const schema = fs.readFileSync(path.join(__dirname, "../db/schema.sql"), "utf8");
    await db.query(schema);
    console.log("Database schema created successfully.");
  } catch (err) {
    console.error("Database initialization failed:", err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
