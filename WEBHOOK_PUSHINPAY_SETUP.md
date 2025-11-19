# 🔧 Configuração do Webhook PushinPay - Guia Completo

## 🚨 PROBLEMA IDENTIFICADO

**Erro 401 "Unauthorized"** no webhook porque o `PUSHINPAY_WEBHOOK_SECRET` não está configurado nos Secrets do Replit.

```
❌ WEBHOOK REJECTED: PUSHINPAY_WEBHOOK_SECRET not configured in Replit Secrets
```

---

## ✅ SOLUÇÃO PASSO-A-PASSO

### PASSO 1: Gerar o Webhook Secret

Você precisa de uma chave secreta forte que será compartilhada entre seu backend (Replit) e a PushinPay.

**Opção A - Gerar via Node.js (RECOMENDADO):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Opção B - Usar string personalizada:**
Crie uma string longa e aleatória (mínimo 32 caracteres). Exemplo:
```
minha-chave-super-secreta-webhook-pushinpay-2025-xyz123
```

💾 **COPIE ESTE VALOR - você vai usar em 2 lugares!**

---

### PASSO 2: Configurar no Replit

1. Abra seu projeto no Replit
2. Clique em **"Tools"** → **"Secrets"** (ícone de cadeado)
3. Clique em **"New Secret"**
4. Configure:
   - **Key:** `PUSHINPAY_WEBHOOK_SECRET`
   - **Value:** Cole a chave gerada no Passo 1
5. Clique em **"Add secret"**

✅ O servidor irá reiniciar automaticamente e carregar o novo secret.

---

### PASSO 3: Configurar no Dashboard PushinPay

1. Acesse o dashboard da PushinPay
2. Vá em **Configurações** → **Webhooks** (ou similar)
3. Configure:
   - **URL do Webhook:** `https://SEU-DOMINIO.replit.dev/api/webhook/pushinpay`
   - **Secret/Token:** Cole **A MESMA CHAVE** do Passo 1
   - **Método:** POST
   - **Header:** X-Token (a PushinPay pode usar X-Token ou Authorization Bearer - ambos funcionam)

💡 **Substitua `SEU-DOMINIO` pelo domínio real do seu Repl.**

Exemplo de URL completa:
```
https://f97c7534-be6a-45e9-80b2-8031403ba7ea-00-2ongynvxkhuun.picard.replit.dev/api/webhook/pushinpay
```

---

### PASSO 4: Verificar Configuração

Após configurar os secrets, verifique os logs do servidor:

**ANTES (erro):**
```
⚠️  WARNING: PUSHINPAY_WEBHOOK_SECRET not configured
❌ WEBHOOK REJECTED: PUSHINPAY_WEBHOOK_SECRET not configured
```

**DEPOIS (sucesso):**
```
✅ Webhook authenticated via X-Token (direct)
✅ Payment confirmed for txid: ABC123...
✅ User abc-xyz activated successfully
```

---

### PASSO 5: Testar o Webhook

#### Método 1: Reprocessar Webhook na PushinPay
1. Acesse o dashboard PushinPay
2. Vá em **Transações**
3. Encontre um pagamento com status **PAGO**
4. Clique em **"REPROCESSAR WEBHOOK"** ou **"Reenviar Notificação"**
5. Verifique os logs do Replit

#### Método 2: Fazer um Pagamento de Teste
1. Gere um novo PIX no seu sistema
2. Pague com PIX de teste (se disponível)
3. Aguarde confirmação automática
4. Verifique os logs

---

## 🔍 DIAGNÓSTICO DE PROBLEMAS

### Problema: Ainda recebo 401 após configurar

**Causas possíveis:**

1. **Secret não foi salvo corretamente**
   - Verifique em Tools → Secrets se `PUSHINPAY_WEBHOOK_SECRET` aparece na lista
   - Reinicie o servidor manualmente se necessário

2. **Secret diferente entre Replit e PushinPay**
   - Certifique-se que copiou EXATAMENTE a mesma chave para ambos os lugares
   - Sem espaços extras no início ou fim
   - Case-sensitive (maiúsculas/minúsculas importam)

3. **Formato do header incorreto**
   - O código aceita ambos: `X-Token: SECRET` e `Authorization: Bearer SECRET`
   - Verifique nos logs qual formato a PushinPay está enviando

### Verificar logs de debug

Os logs agora mostram informações detalhadas:

```
🔍 [WEBHOOK DEBUG] Headers received:
  X-Token: minha-chav...
  Authorization: NOT PROVIDED
```

Se você vê:
- `❌ WEBHOOK REJECTED: Token mismatch` → Secret diferente entre Replit e PushinPay
- `❌ WEBHOOK REJECTED: No authentication header` → PushinPay não está enviando o header
- `✅ Webhook authenticated` → Tudo funcionando!

---

## 📋 CHECKLIST FINAL

Antes de testar, confirme:

- [ ] `PUSHINPAY_WEBHOOK_SECRET` configurado no Replit Secrets
- [ ] Mesma chave configurada no dashboard PushinPay
- [ ] URL do webhook correta no PushinPay (com `/api/webhook/pushinpay`)
- [ ] Servidor Replit rodando (sem erros)
- [ ] Logs mostram "Webhook authenticated" ao testar

---

## 🎯 COMO FUNCIONA O FLUXO COMPLETO

1. **Cliente gera PIX** → Backend cria payment com status "pending"
2. **Cliente paga PIX** → PushinPay recebe confirmação do banco
3. **PushinPay envia webhook** → POST para `/api/webhook/pushinpay` com:
   - Header `X-Token: SEU_SECRET`
   - Body `{ status: "pago", txid: "ABC123..." }`
4. **Backend valida** → Compara secret com timingSafeEqual
5. **Backend atualiza** → Payment status = "paid", User status = "ATIVO"
6. **Cliente recebe acesso** → Credenciais desbloqueadas

---

## 🔐 SEGURANÇA

O código implementa:
- ✅ Constant-time comparison (`crypto.timingSafeEqual`) para prevenir timing attacks
- ✅ Idempotência - webhook pode ser chamado múltiplas vezes sem duplicar
- ✅ Validação de TXID para prevenir fraudes
- ✅ Trim automático para evitar problemas com espaços
- ✅ Suporte a ambos formatos: X-Token e Authorization Bearer
- ✅ Logs detalhados para troubleshooting (apenas em development)

---

## 📞 Suporte

Se ainda tiver problemas:
1. Verifique os logs do servidor no Replit
2. Verifique os logs de webhook no dashboard PushinPay
3. Confirme que a chave secreta é EXATAMENTE a mesma em ambos os lugares
4. Entre em contato com suporte da PushinPay se o webhook não estiver sendo enviado
