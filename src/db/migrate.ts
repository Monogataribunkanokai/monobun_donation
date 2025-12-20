// Monobun Donation System - Database Migration Script

import { getDb, closeDb } from "../lib/db";
import { hashPassword } from "../lib/auth";
import { logger } from "../lib/logger";

async function migrate() {
  logger.info("Starting database migration...");

  const db = getDb();

  try {
    // Read and execute schema.sql
    const schemaPath = new URL("./schema.sql", import.meta.url).pathname;
    const schema = await Bun.file(schemaPath).text();

    logger.info("Executing schema...");
    await db.unsafe(schema);
    logger.info("Schema executed successfully");

    // Create initial admin if not exists
    const adminEmail = process.env.ADMIN_INITIAL_EMAIL;
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;

    if (adminEmail && adminPassword) {
      // Check if admin already exists
      const existing = await db`
        SELECT id FROM admins WHERE email = ${adminEmail} LIMIT 1
      `;

      if (existing.length === 0) {
        const passwordHash = await hashPassword(adminPassword);

        await db`
          INSERT INTO admins (email, password_hash, role, must_change_password)
          VALUES (${adminEmail}, ${passwordHash}, 'editor', true)
        `;

        logger.info("Initial admin created", { email: adminEmail });
        logger.warn("Please change the initial admin password on first login!");
      } else {
        logger.info("Initial admin already exists", { email: adminEmail });
      }
    } else {
      logger.warn("ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD not set. No initial admin created.");
    }

    logger.info("Migration completed successfully");
  } catch (error) {
    logger.error("Migration failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Run migration
migrate();
