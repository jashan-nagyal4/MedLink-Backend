require("dotenv").config();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env and configure it.");
  process.exit(1);
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set to a random string of at least 32 characters.");
  process.exit(1);
}

const app = require("./app");
const db = require("./config/db");
const port = Number(process.env.PORT || 4000);

async function start() {
  await db.query("SELECT 1");
  console.log("Connected to PostgreSQL.");
  const server = app.listen(port, () => console.log(`MedLink API listening at http://localhost:${port}`));
  const shutdown = async () => {
    server.close(async () => {
      await db.pool.end();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch(err => {
  console.error("Could not start API:", err.message);
  process.exit(1);
});
