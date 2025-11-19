# Configuração de Produção - VectorPro

## 🔐 Secrets Obrigatórios

Antes de fazer deploy, configure os seguintes secrets no Replit:

### 1. DATABASE_URL
**Status:** ✅ Configurado automaticamente pelo Replit
**Descrição:** URL de conexão com PostgreSQL (Neon)
**Exemplo:** `postgresql://user:password@host/database`

### 2. SESSION_SECRET ⚠️ CRÍTICO
**Status:** ❌ PRECISA SER CONFIGURADO
**Descrição:** Chave secreta para criptografar sessões de usuário
**Como gerar:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**Importante:** Nunca use a chave padrão em produção!

### 3. PUSHINPAY_TOKEN
**Status:** ⚠️ Verificar se está configurado
**Descrição:** Token de autenticação da API PushinPay para gerar PIX
**Onde obter:** Dashboard PushinPay
**Formato:** Token fornecido pela PushinPay

### 4. PUSHINPAY_WEBHOOK_SECRET ⚠️ CRÍTICO
**Status:** ❌ NÃO CONFIGURADO - SECURITY RISK!
**Descrição:** Chave secreta para validar webhooks da PushinPay
**Como gerar:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**Importante:** Configure a mesma chave no dashboard da PushinPay

## 📧 Secrets para Email (Resend)

### 5. Integração Resend
**Status:** ✅ Configurado automaticamente pelo Replit
**Descrição:** REPLIT_CONNECTORS_HOSTNAME, REPL_IDENTITY, WEB_REPL_RENEWAL
**Ação:** Nenhuma - gerenciado pelo Replit Connector

## 🧪 Secrets Opcionais

### 6. USE_PUSHINPAY_DEMO
**Status:** Opcional
**Descrição:** Usar modo demo do PushinPay (para testes)
**Valores:** `"true"` ou não definir
**Produção:** Não definir (usar API real)

## ⚙️ Variáveis Auto-Configuradas

As seguintes variáveis são configuradas automaticamente pelo Replit:
- `NODE_ENV` - Definido como "production" no deploy
- `PORT` - Porta do servidor (padrão: 5000)
- `REPLIT_DEV_DOMAIN` - Domínio da aplicação

## 🚨 Checklist Antes do Deploy

- [ ] Configurar `SESSION_SECRET` com chave forte
- [ ] Configurar `PUSHINPAY_WEBHOOK_SECRET` com chave forte
- [ ] Verificar `PUSHINPAY_TOKEN` está configurado
- [ ] Configurar a mesma `PUSHINPAY_WEBHOOK_SECRET` no dashboard PushinPay
- [ ] Remover ou desabilitar `USE_PUSHINPAY_DEMO`
- [ ] Verificar integração Resend está ativa
- [ ] Testar webhook de pagamento em ambiente de staging

## 📝 Como Configurar Secrets no Replit

1. Abrir o projeto no Replit
2. Clicar em "Tools" → "Secrets"
3. Adicionar cada secret:
   - Key: Nome da variável (ex: SESSION_SECRET)
   - Value: Valor gerado
4. Salvar

## 🔒 Segurança Adicional

### Webhook PushinPay
O webhook valida:
1. Header `x-token` contra `PUSHINPAY_WEBHOOK_SECRET`
2. TXID único para prevenir duplicatas
3. Valores em centavos (1750 = R$ 17,50)

### Sessões de Usuário
- Cookies com `httpOnly: true` (proteção XSS)
- `secure: true` em produção (HTTPS only)
- `sameSite: 'lax'` (proteção CSRF)

### Senhas
- Hash com bcrypt (10 rounds)
- Tokens de reset expiram em 24 horas

## 🎯 Cron Jobs

**Importante:** Cron jobs para emails de cobrança requerem:
- Always-On Repl OU
- Reserved VM

Caso contrário, os jobs só executam quando o servidor está ativo.

## 📞 Suporte

WhatsApp: 5544936184613 (configurado nos emails)
