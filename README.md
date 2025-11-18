# Sistema de Gerenciamento de Credenciais com Pagamento PIX

Sistema completo para gerenciamento de credenciais mensais com controle de acesso baseado em pagamentos via PIX PushinPay.

## 🚀 Funcionalidades

### Painel do Cliente
- Login com autenticação segura
- Visualização de credenciais mensais
- Credenciais bloqueadas automaticamente quando pagamento está inativo
- Histórico de pagamentos
- Geração de PIX para pagamento
- Status de pagamento em tempo real

### Painel Admin
- Gerenciamento completo de usuários
- Criação e edição de credenciais para usuários
- Monitor de pagamentos
- Controle de status de usuários (ATIVO/INATIVO)

## 🔐 Credenciais de Acesso

### Admin
- Email: `admin@example.com`
- Senha: `admin123`
- Acesso: `/admin/login`

### Cliente de Teste
- Email: `cliente@example.com`
- Senha: `cliente123`
- Acesso: `/`

## 📋 Como Usar

### 1. Admin - Criar Credenciais para Usuário

1. Acesse `/admin/login` e faça login com as credenciais admin
2. Navegue para a aba "Credenciais" no menu lateral
3. Clique em "Adicionar Credencial"
4. Preencha o formulário:
   - Selecione o usuário
   - Informe o mês/período (ex: "Janeiro 2025")
   - Adicione os dados da credencial em formato JSON:
     ```json
     {
       "usuario": "user@example.com",
       "senha": "SenhaSegura@123",
       "chaveAPI": "sk_live_abc123xyz"
     }
     ```
5. Clique em "Criar"

As credenciais criadas ficam imediatamente disponíveis para o usuário correspondente.

### 2. Cliente - Visualizar Credenciais

1. Acesse `/` e faça login com as credenciais do cliente
2. No dashboard, você verá:
   - Status do pagamento (ATIVO ou INATIVO)
   - Credenciais do mês atual (se pagamento estiver ativo)
   - Histórico de pagamentos
3. Se o pagamento estiver inativo, as credenciais ficam bloqueadas

### 3. Cliente - Realizar Pagamento PIX

1. Se o status estiver INATIVO, clique em "Pagar via PIX"
2. Será gerado um QR Code e código PIX
3. Copie o código e pague através do seu banco
4. Após confirmação do pagamento:
   - Status do usuário é atualizado para ATIVO
   - Credenciais são liberadas automaticamente

## 🏗️ Arquitetura Técnica

### Backend
- **Express.js** com TypeScript
- **Autenticação**: express-session + bcrypt
- **Storage**: In-memory (MemStorage) - pode ser facilmente substituído por PostgreSQL
- **Sessões**: 7 dias de duração com cookies HTTP-only

### Frontend
- **React** com TypeScript
- **Wouter** para roteamento
- **TanStack Query** para gerenciamento de estado
- **Shadcn UI** para componentes
- **Tailwind CSS** para estilização

### API Routes

#### Autenticação
- `POST /api/auth/login` - Login do cliente
- `POST /api/auth/admin/login` - Login do admin
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Obter usuário atual

#### Usuários (Admin)
- `GET /api/users` - Listar todos os usuários
- `POST /api/users` - Criar usuário
- `PATCH /api/users/:id` - Atualizar usuário
- `DELETE /api/users/:id` - Deletar usuário

#### Credenciais
- `GET /api/credentials` - Obter credenciais do usuário logado
- `GET /api/admin/credentials` - Admin: listar todas as credenciais
- `POST /api/admin/credentials` - Admin: criar credencial
- `PATCH /api/admin/credentials/:id` - Admin: atualizar credencial
- `DELETE /api/admin/credentials/:id` - Admin: deletar credencial

#### Pagamentos
- `GET /api/payments` - Obter pagamentos do usuário
- `POST /api/payments/pix` - Gerar pagamento PIX
- `GET /api/admin/payments` - Admin: listar todos os pagamentos
- `POST /api/webhook/pushinpay` - Webhook para confirmação de pagamento

## 🔄 Fluxo de Pagamento

1. Cliente solicita pagamento → Sistema gera PIX
2. Cliente paga via PIX no app do banco
3. PushinPay envia webhook para `/api/webhook/pushinpay`
4. Sistema atualiza:
   - Status do pagamento para "paid"
   - Status do usuário para "ATIVO"
   - Data do último pagamento
5. Credenciais são automaticamente liberadas para o cliente

## 💾 Modelo de Dados

### User
```typescript
{
  id: string;
  email: string;
  password: string; // bcrypt hash
  status: "ATIVO" | "INATIVO";
  isAdmin: "true" | "false";
  ultimoPagamento: Date | null;
}
```

### Credential
```typescript
{
  id: string;
  userId: string;
  month: string; // ex: "Janeiro 2025"
  data: string; // JSON string com os dados
}
```

### Payment
```typescript
{
  id: string;
  userId: string;
  amount: string;
  status: "paid" | "pending" | "failed";
  txid: string | null;
  createdAt: Date;
}
```

## 🔒 Segurança

- Senhas criptografadas com bcrypt (salt rounds: 10)
- Sessões com cookies HTTP-only
- Middleware de autenticação em todas as rotas protegidas
- Validação de admin para rotas administrativas
- Credenciais bloqueadas automaticamente se pagamento inativo

## 🚀 Como Executar

```bash
# O projeto já está configurado e rodando
npm run dev
```

Acesse:
- Cliente: http://localhost:5000
- Admin: http://localhost:5000/admin/login

## 📝 Notas Importantes

- O sistema usa armazenamento em memória para desenvolvimento
- Para produção, substitua `MemStorage` por implementação com PostgreSQL
- Configure a variável de ambiente `SESSION_SECRET` em produção
- Integre com a API real do PushinPay (atualmente usando mock)
- O webhook do PushinPay deve ser configurado para apontar para `/api/webhook/pushinpay`
