import { runMultiServiceMigration } from "./add-multi-service-support";

runMultiServiceMigration()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
