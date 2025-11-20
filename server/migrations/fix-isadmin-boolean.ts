/**
 * Migration: Convert isAdmin from text to boolean
 * 
 * Problem: isAdmin field is stored as text ("true"/"false") instead of boolean
 * Security Risk: In JavaScript, "false" is truthy, causing permission issues
 * Solution: Convert to proper boolean type
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

async function migrateIsAdminToBoolean() {
  console.log("🔄 Starting migration: Converting isAdmin from text to boolean...");
  
  try {
    // Step 1: Add temporary boolean column
    console.log("Step 1: Adding temporary boolean column...");
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin_bool BOOLEAN DEFAULT FALSE
    `);
    
    // Step 2: Copy and convert values
    console.log("Step 2: Converting text values to boolean...");
    await db.execute(sql`
      UPDATE users 
      SET is_admin_bool = CASE 
        WHEN is_admin = 'true' THEN TRUE
        ELSE FALSE
      END
    `);
    
    // Step 3: Log current state for verification
    const beforeDrop = await db.execute(sql`
      SELECT id, email, is_admin, is_admin_bool 
      FROM users 
      ORDER BY is_admin DESC
    `);
    console.log("Current users status:");
    beforeDrop.rows.forEach((row: any) => {
      console.log(`  ${row.email}: text='${row.is_admin}' → bool=${row.is_admin_bool}`);
    });
    
    // Step 4: Drop old column
    console.log("Step 3: Dropping old text column...");
    await db.execute(sql`
      ALTER TABLE users 
      DROP COLUMN is_admin
    `);
    
    // Step 5: Rename new column to original name
    console.log("Step 4: Renaming boolean column...");
    await db.execute(sql`
      ALTER TABLE users 
      RENAME COLUMN is_admin_bool TO is_admin
    `);
    
    // Step 6: Verify final state
    const afterMigration = await db.execute(sql`
      SELECT id, email, is_admin 
      FROM users 
      ORDER BY is_admin DESC
    `);
    
    console.log("✅ Migration completed! Final state:");
    afterMigration.rows.forEach((row: any) => {
      console.log(`  ${row.email}: admin=${row.is_admin}`);
    });
    
    return true;
  } catch (error) {
    console.error("❌ Migration failed:", error);
    
    // Try to rollback if something went wrong
    try {
      console.log("Attempting rollback...");
      await db.execute(sql`
        ALTER TABLE users DROP COLUMN IF EXISTS is_admin_bool
      `);
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }
    
    throw error;
  }
}

// Execute migration if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateIsAdminToBoolean()
    .then(() => {
      console.log("✨ Migration completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Migration failed:", error);
      process.exit(1);
    });
}

export { migrateIsAdminToBoolean };