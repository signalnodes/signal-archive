import { runMigrations } from "./migrate";

console.log("[migrate] Running pending migrations...");

runMigrations()
  .then(() => {
    console.log("[migrate] All migrations applied");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[migrate] Migration failed:", err);
    process.exit(1);
  });
