import bcrypt from "bcrypt";
import { storage } from "./storage";

export async function initializeData() {
  // Check if admin already exists
  const existingAdmin = await storage.getUserByEmail("admin@example.com");
  
  if (!existingAdmin) {
    console.log("Initializing database with sample data...");
    
    // Create admin user
    const adminPassword = await bcrypt.hash("admin123", 10);
    const admin = await storage.createUser({
      email: "admin@example.com",
      password: adminPassword,
      status: "ATIVO",
      isAdmin: "true",
    });
    console.log("✓ Admin user created: admin@example.com / admin123");

    // Create sample client user
    const clientPassword = await bcrypt.hash("cliente123", 10);
    const client = await storage.createUser({
      email: "cliente@example.com",
      password: clientPassword,
      status: "ATIVO",
      isAdmin: "false",
    });
    
    // Update client with payment date
    await storage.updateUser(client.id, {
      ultimoPagamento: new Date(),
    });
    console.log("✓ Client user created: cliente@example.com / cliente123");

    // Create sample shared credentials (available to all active users)
    const credentialDataJan = {
      usuario: "vectorizer@service.com",
      senha: "Vectorizer@2025",
      chaveAPI: "vk_live_abc123xyz789",
    };

    await storage.createCredential({
      userId: null,
      month: "Janeiro 2025",
      data: JSON.stringify(credentialDataJan),
    });
    
    const credentialDataFev = {
      usuario: "vectorizer@service.com",
      senha: "Vectorizer@Feb2025",
      chaveAPI: "vk_live_feb456def123",
    };

    await storage.createCredential({
      userId: null,
      month: "Fevereiro 2025",
      data: JSON.stringify(credentialDataFev),
    });
    console.log("✓ Sample shared credentials created");

    // Create sample payment (amount in cents as string: "9990" = R$99.90)
    await storage.createPayment({
      userId: client.id,
      amount: "9990", // Amount in cents as string for decimal column
      status: "paid",
      txid: "SAMPLE_TXN_123",
    });
    console.log("✓ Sample payment created (R$99.90)");

    console.log("\n==========================================");
    console.log("Database initialized successfully!");
    console.log("==========================================");
    console.log("\nAccess credentials:");
    console.log("  Admin: admin@example.com / admin123");
    console.log("  Client: cliente@example.com / cliente123");
    console.log("==========================================\n");
  }
}
