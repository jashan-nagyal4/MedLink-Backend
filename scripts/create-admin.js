require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../src/config/db");

(async () => {
  try {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
      throw new Error("Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in .env.");
    }
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const result = await db.query(
      `INSERT INTO users (name,email,password_hash,role)
       VALUES ($1,LOWER($2),$3,'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id,email,role`,
      [ADMIN_NAME, ADMIN_EMAIL, passwordHash]
    );
    if (result.rowCount) console.log("Admin account created:", result.rows[0]);
    else console.log("An account with that email already exists; no changes made.");
  } catch (err) {
    console.error("Admin creation failed:", err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
