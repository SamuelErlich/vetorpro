import { db } from "../db";
import { services, userServices, payments, credentials, users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

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

const VECTORIZER_SERVICE_ID = "vectorizer-001"; // ID fixo para o serviço Vectorizer

export async function runMultiServiceMigration() {
  try {
    console.log("🚀 [MIGRATION] Iniciando migração para suporte multi-serviço...");

    // Passo 1: Verificar se o serviço Vectorizer já existe
    let vectorizerService = await db.query.services.findFirst({
      where: eq(services.id, VECTORIZER_SERVICE_ID),
    });

    if (!vectorizerService) {
      console.log("📦 [MIGRATION] Criando serviço padrão: Vectorizer");
      
      // Inserir serviço Vectorizer
      const [newService] = await db.insert(services).values({
        id: VECTORIZER_SERVICE_ID,
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
      SET service_id = ${VECTORIZER_SERVICE_ID}
      WHERE service_id IS NULL
    `);
    console.log(`✅ [MIGRATION] Pagamentos atualizados: ${updatePaymentsResult.rowCount || 0}`);

    // Passo 3: Atualizar credentials existentes que não têm serviceId
    console.log("🔑 [MIGRATION] Atualizando credenciais existentes...");
    const updateCredentialsResult = await db.execute(sql`
      UPDATE credentials 
      SET service_id = ${VECTORIZER_SERVICE_ID}
      WHERE service_id IS NULL
    `);
    console.log(`✅ [MIGRATION] Credenciais atualizadas: ${updateCredentialsResult.rowCount || 0}`);

    // Passo 4: Criar registros em user_services para usuários existentes
    console.log("👥 [MIGRATION] Criando assinaturas de usuários...");
    
    // Buscar todos os usuários
    const allUsers = await db.select().from(users);
    
    for (const user of allUsers) {
      // Verificar se já existe uma assinatura para este usuário
      const existingSubscription = await db.query.userServices.findFirst({
        where: sql`${userServices.userId} = ${user.id} AND ${userServices.serviceId} = ${VECTORIZER_SERVICE_ID}`,
      });

      if (!existingSubscription) {
        // Criar assinatura baseada no status atual do usuário
        await db.insert(userServices).values({
          userId: user.id,
          serviceId: VECTORIZER_SERVICE_ID,
          status: user.status, // Copiar status atual do usuário
          ultimoPagamento: user.ultimoPagamento,
          proximoPagamento: user.nextPaymentDate,
        });
        console.log(`  ✓ Criada assinatura para ${user.email}`);
      }
    }

    console.log(`✅ [MIGRATION] Assinaturas criadas para ${allUsers.length} usuários`);
    console.log("🎉 [MIGRATION] Migração concluída com sucesso!");

    return {
      success: true,
      serviceId: VECTORIZER_SERVICE_ID,
      usersProcessed: allUsers.length,
    };

  } catch (error) {
    console.error("❌ [MIGRATION] Erro durante migração:", error);
    throw error;
  }
}

// Auto-executar se este arquivo for executado diretamente
if (require.main === module) {
  runMultiServiceMigration()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
