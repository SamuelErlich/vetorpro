import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

// This migration adds the planId field to user_services table for RemoveBG plan management
export async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    return;
  }

  const db = drizzle(neon(databaseUrl));

  try {
    console.log("Adding planId field to user_services table...");
    
    // Add planId column to user_services table
    await db.execute(sql`
      ALTER TABLE user_services 
      ADD COLUMN IF NOT EXISTS plan_id VARCHAR
      REFERENCES removebg_plans(id)
    `);
    
    console.log("✅ Successfully added planId field to user_services table");
    
    // Check if there are existing RemoveBG subscriptions that need plan assignment
    const result = await db.execute(sql`
      SELECT us.*, u.email 
      FROM user_services us 
      JOIN users u ON us.user_id = u.id 
      WHERE us.service_id = 'removebg-001' 
        AND us.plan_id IS NULL
        AND us.credits_available > 0
    `);
    
    if (result.rows && result.rows.length > 0) {
      console.log(`Found ${result.rows.length} RemoveBG subscriptions without plans`);
      console.log("These users may need plan assignment:");
      for (const row of result.rows) {
        console.log(`  - ${row.email}: ${row.credits_available} credits`);
      }
      console.log("\nYou can manually assign plans through the admin interface.");
    }
    
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });