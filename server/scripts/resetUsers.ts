#!/usr/bin/env node
import bcrypt from 'bcrypt';
import { db, sql } from '../db';
import { 
  users, 
  userServices, 
  credentials, 
  payments, 
  passwordResets,
  serviceAccounts,
  subscriptions,
  removeBgUsage,
  services
} from '@/shared/schema';

/**
 * Script para limpar todos os usuários e criar apenas:
 * 1. Admin: samuerlich@gmail.com (admin)
 * 2. User: samuerlich@gmail.com (normal)
 */
async function resetUsers() {
  console.log('🔄 Iniciando reset de usuários...\n');
  
  try {
    // Start transaction
    await db.transaction(async (tx) => {
      // 1. Delete all dependent records first (in order)
      console.log('🗑️  Removendo registros dependentes...');
      
      // Delete in order to respect foreign key constraints
      await tx.delete(removeBgUsage);
      console.log('  ✓ RemoveBG usage removido');
      
      await tx.delete(credentials);
      console.log('  ✓ Credenciais removidas');
      
      await tx.delete(payments);
      console.log('  ✓ Pagamentos removidos');
      
      await tx.delete(passwordResets);
      console.log('  ✓ Password resets removidos');
      
      await tx.delete(serviceAccounts);
      console.log('  ✓ Service accounts removidos');
      
      await tx.delete(subscriptions);
      console.log('  ✓ Assinaturas removidas');
      
      await tx.delete(userServices);
      console.log('  ✓ UserServices removidos');
      
      // 2. Delete all users
      await tx.delete(users);
      console.log('  ✓ Todos os usuários removidos\n');
      
      // 3. Hash the password
      const hashedPassword = await bcrypt.hash('SDKmm2020@', 10);
      console.log('🔒 Senha hashada com sucesso\n');
      
      // 4. Create admin user
      const [adminUser] = await tx.insert(users).values({
        email: 'samuerlich@gmail.com',
        password: hashedPassword,
        status: 'ATIVO',
        isAdmin: 'true',
        discount: 0,
        ultimoPagamento: null,
        nextPaymentDate: null,
      }).returning();
      
      console.log('✅ Usuário ADMIN criado:');
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Admin: ${adminUser.isAdmin}`);
      console.log(`   Status: ${adminUser.status}`);
      console.log(`   ID: ${adminUser.id}\n`);
      
      // 5. Create normal user (same email for testing)
      // Note: In a real system, you can't have duplicate emails
      // So we'll create with a different email for the normal user
      const [normalUser] = await tx.insert(users).values({
        email: 'user.samuerlich@gmail.com', // Prefixed with 'user.' to avoid duplicate
        password: hashedPassword,
        status: 'ATIVO',
        isAdmin: 'false',
        discount: 0,
        ultimoPagamento: null,
        nextPaymentDate: null,
      }).returning();
      
      console.log('✅ Usuário NORMAL criado:');
      console.log(`   Email: ${normalUser.email}`);
      console.log(`   Admin: ${normalUser.isAdmin}`);
      console.log(`   Status: ${normalUser.status}`);
      console.log(`   ID: ${normalUser.id}\n`);
      
      // 6. Create UserServices entries for both users
      const allServices = await tx.select().from(services);
      console.log(`📦 Criando ${allServices.length} UserServices para cada usuário...`);
      
      for (const service of allServices) {
        // For admin
        await tx.insert(userServices).values({
          userId: adminUser.id,
          serviceId: service.id,
          status: 'ATIVO',
          ultimoPagamento: null,
          proximoPagamento: null,
        });
        
        // For normal user
        await tx.insert(userServices).values({
          userId: normalUser.id,
          serviceId: service.id,
          status: 'ATIVO',
          ultimoPagamento: null,
          proximoPagamento: null,
        });
      }
      
      console.log('  ✓ UserServices criados para ambos os usuários\n');
    });
    
    console.log('🎉 Reset de usuários concluído com sucesso!\n');
    console.log('📝 Credenciais configuradas:');
    console.log('──────────────────────────────');
    console.log('ADMIN:');
    console.log('  Email: samuerlich@gmail.com');
    console.log('  Senha: SDKmm2020@');
    console.log('  Acesso: /admin/login');
    console.log('');
    console.log('USUÁRIO NORMAL (para testes):');
    console.log('  Email: user.samuerlich@gmail.com');
    console.log('  Senha: SDKmm2020@');
    console.log('  Acesso: /');
    console.log('──────────────────────────────');
    
  } catch (error) {
    console.error('❌ Erro durante o reset:', error);
    throw error;
  }
}

// Execute the script
resetUsers()
  .then(() => {
    console.log('\n✅ Script executado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });