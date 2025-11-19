import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { removeBgPlans } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function updateRemoveBgPricing() {
  try {
    console.log("🔄 Updating RemoveBG pricing plans...");
    
    const sqlClient = neon(process.env.DATABASE_URL!);
    const db = drizzle(sqlClient);
    
    // Delete existing plans
    await db.delete(removeBgPlans);
    console.log("✓ Old plans removed");
    
    // Insert new plans with correct pricing
    const newPlans = [
      { id: 'removebg-start', name: 'Start', credits: 30, price: '14.90' },
      { id: 'removebg-pro', name: 'Pro', credits: 120, price: '34.90' },
      { id: 'removebg-studio', name: 'Studio', credits: 300, price: '69.90' },
    ];
    
    for (const plan of newPlans) {
      await db.insert(removeBgPlans).values({
        id: plan.id,
        name: plan.name,
        credits: plan.credits,
        price: plan.price,
      });
      console.log(`✓ Created ${plan.name} plan: ${plan.credits} credits for R$ ${plan.price}`);
    }
    
    console.log("✅ RemoveBG pricing updated successfully!");
    return true;
  } catch (error) {
    console.error("❌ Error updating RemoveBG pricing:", error);
    return false;
  }
}

// Run the migration
updateRemoveBgPricing();