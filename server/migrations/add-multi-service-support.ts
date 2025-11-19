import { services, userServices, payments, credentials, users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { DEFAULT_SERVICE_ID } from "@shared/constants";

/**
 * Migration para adicionar suporte a múltiplos serviços
 * 
 * Esta migration:
 * 1. Cria tabelas services e user_services
 * 2. Insere o serviço padrão "Vectorizer"
 * 3. Atualiza payments e credentials existentes com serviceId
 * 4. Cria registros em user_services para usuários existentes
 * 
 * Nota: Esta migration é idempotente e pode ser executada múltiplas vezes sem efeitos colaterais
 */

export async function runMultiServiceMigration() {
  try {
    console.log("🚀 [MIGRATION] Iniciando migração para suporte multi-serviço...");

    // Inicializar conexão com banco
    const sqlClient = neon(process.env.DATABASE_URL!);
    const db = drizzle(sqlClient);

    // Passo 1: Verificar se o serviço Vectorizer já existe
    const existingServices = await db.select().from(services).where(eq(services.id, DEFAULT_SERVICE_ID));
    let vectorizerService = existingServices[0];

    if (!vectorizerService) {
      console.log("📦 [MIGRATION] Criando serviço padrão: Vectorizer");
      
      // Inserir serviço Vectorizer
      const [newService] = await db.insert(services).values({
        id: DEFAULT_SERVICE_ID,
        nome: "Vectorizer",
        descricao: "Serviço de vetorização de imagens",
        preco: "17.50",
        ativo: true,
      }).returning();

      vectorizerService = newService;
      console.log("✅ [MIGRATION] Serviço Vectorizer criado com sucesso");
    } else {
      console.log("✓ [MIGRATION] Serviço Vectorizer já existe");
    }

    // Passo 2: Atualizar payments existentes que não têm serviceId
    console.log("💰 [MIGRATION] Atualizando pagamentos existentes...");
    const updatePaymentsResult = await db.execute(sql`
      UPDATE payments 
      SET service_id = ${DEFAULT_SERVICE_ID}
      WHERE service_id IS NULL
    `);
    console.log(`✅ [MIGRATION] Pagamentos atualizados: ${updatePaymentsResult.rowCount || 0}`);

    // Passo 3: Atualizar credentials existentes que não têm serviceId
    console.log("🔑 [MIGRATION] Atualizando credenciais existentes...");
    const updateCredentialsResult = await db.execute(sql`
      UPDATE credentials 
      SET service_id = ${DEFAULT_SERVICE_ID}
      WHERE service_id IS NULL
    `);
    console.log(`✅ [MIGRATION] Credenciais atualizadas: ${updateCredentialsResult.rowCount || 0}`);

    // Passo 4: Criar registros em user_services para usuários existentes
    console.log("👥 [MIGRATION] Criando assinaturas de usuários...");
    
    // Buscar todos os usuários
    const allUsers = await db.select().from(users);
    let createdCount = 0;
    
    for (const user of allUsers) {
      // Verificar se já existe uma assinatura para este usuário
      const existingSubscriptions = await db.select().from(userServices).where(
        sql`${userServices.userId} = ${user.id} AND ${userServices.serviceId} = ${DEFAULT_SERVICE_ID}`
      );

      if (existingSubscriptions.length === 0) {
        // Criar assinatura baseada no status atual do usuário
        await db.insert(userServices).values({
          userId: user.id,
          serviceId: DEFAULT_SERVICE_ID,
          status: user.status, // Copiar status atual do usuário
          ultimoPagamento: user.ultimoPagamento,
          proximoPagamento: user.nextPaymentDate,
        });
        createdCount++;
      }
    }

    console.log(`✅ [MIGRATION] ${createdCount} assinaturas criadas para ${allUsers.length} usuários`);
    console.log("🎉 [MIGRATION] Migração concluída com sucesso!");

    return {
      success: true,
      serviceId: DEFAULT_SERVICE_ID,
      usersProcessed: allUsers.length,
    };

  } catch (error) {
    console.error("❌ [MIGRATION] Erro durante migração:", error);
    throw error;
  }
}

// Para executar esta migration manualmente:
// npx tsx server/migrations/run-migration.ts
