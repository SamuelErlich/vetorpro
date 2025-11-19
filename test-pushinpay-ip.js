// Test script para verificar erro de IP com PushinPay
const fetch = require('node-fetch');

async function testPushinPayAPI() {
  const token = process.env.PUSHINPAY_TOKEN;
  
  if (!token) {
    console.error("❌ PUSHINPAY_TOKEN não configurado");
    return;
  }

  console.log("📞 Testando API da PushinPay...");
  console.log(`🌐 IP do servidor: ${await fetch('https://api.ipify.org').then(r => r.text())}`);
  
  const txid = `TEST_${Date.now()}`;
  const webhookUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/api/webhook/pushinpay`;
  
  console.log(`📨 Webhook URL: ${webhookUrl}`);
  
  const requestData = {
    value: 1750, // R$ 17,50 em centavos
    correlationID: txid,
    comment: "Pagamento Mensal - Vectorizer", 
    webhookUrl: webhookUrl
  };

  console.log("📤 Enviando requisição:", JSON.stringify(requestData, null, 2));

  try {
    const response = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(requestData)
    });

    console.log(`📥 Status da resposta: ${response.status}`);
    
    const responseText = await response.text();
    console.log("📥 Resposta completa:", responseText);
    
    if (!response.ok) {
      console.error(`❌ Erro ${response.status}: ${responseText}`);
      
      // Tentar parsear erro JSON se possível
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.error || errorJson.message) {
          console.error("🔍 Detalhes do erro:", errorJson);
        }
      } catch(e) {
        // Não é JSON, mostrar como texto mesmo
      }
    } else {
      console.log("✅ Sucesso! PIX gerado com sucesso");
    }
  } catch (error) {
    console.error("❌ Erro na requisição:", error.message);
  }
}

testPushinPayAPI();