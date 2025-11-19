import { storage } from "../storage";

export async function addRemoveBgService() {
  console.log("Running RemoveBG service migration...");

  try {
    // Check if RemoveBG service already exists
    const existingService = await storage.getService("removebg-001");
    
    if (!existingService) {
      // Create RemoveBG service
      await storage.createService({
        id: "removebg-001",
        nome: "RemoveBG",
        descricao: "Serviço de remoção de fundo de imagens com IA",
        preco: "30.00", // Base price for the service
        ativo: true,
      });
      console.log("✓ RemoveBG service created");
    } else {
      console.log("✓ RemoveBG service already exists");
    }

    // Check and create RemoveBG plans
    const existingPlans = await storage.getRemoveBgPlans();
    
    if (existingPlans.length === 0) {
      // Create Start plan
      await storage.createRemoveBgPlan({
        name: "Start",
        credits: 30,
        price: "29.90",
      });
      console.log("✓ RemoveBG Start plan created (30 credits - R$ 29.90)");

      // Create Pro plan
      await storage.createRemoveBgPlan({
        name: "Pro",
        credits: 120,
        price: "99.90",
      });
      console.log("✓ RemoveBG Pro plan created (120 credits - R$ 99.90)");

      // Create Studio plan
      await storage.createRemoveBgPlan({
        name: "Studio",
        credits: 300,
        price: "199.90",
      });
      console.log("✓ RemoveBG Studio plan created (300 credits - R$ 199.90)");
    } else {
      console.log("✓ RemoveBG plans already exist");
    }

    console.log("✓ RemoveBG service migration completed successfully");
  } catch (error) {
    console.error("Error running RemoveBG migration:", error);
    throw error;
  }
}