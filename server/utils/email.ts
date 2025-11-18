import { Resend } from 'resend';

// Replit Resend Integration
// Uses secure connector with automatic credential management
let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send email using Resend (via Replit integration)
 * Returns true if sent successfully, false otherwise
 * Safe to call - handles connection errors gracefully
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, html } = options;

  try {
    // Get fresh client for each email (credentials may rotate)
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'VectorPro <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    });

    if (result.error) {
      console.error('❌ [EMAIL ERROR]', result.error);
      return false;
    }

    console.log(`✅ [EMAIL SENT] To: ${to} | Subject: ${subject} | ID: ${result.data?.id}`);
    return true;
  } catch (error: any) {
    // Handle connection not configured
    if (error.message?.includes('not connected')) {
      console.warn(`📧 [EMAIL DISABLED] Resend integration not configured`);
      console.warn(`   Would send to ${to}: ${subject}`);
      console.warn('   Set up Resend integration in Replit to enable email sending.');
      return false;
    }
    console.error('❌ [EMAIL EXCEPTION]', error);
    return false;
  }
}

/**
 * Email templates for payment notifications
 * All payments are due on DAY 5 of each month
 */
export const emailTemplates = {
  // Dia 3: Aviso prévio (vence em 2 dias)
  paymentDueInTwoDays: (userName: string) => ({
    subject: '💡 Lembrete: Sua mensalidade vence em 2 dias - VectorPro',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f0f9ff; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .info { background: #dbeafe; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✨ VectorPro</h1>
            </div>
            <div class="content">
              <h2>Olá${userName ? ' ' + userName : ''}!</h2>
              <div class="info">
                <strong>💡 Lembrete:</strong> Sua mensalidade vence <strong>em 2 dias (dia 5)</strong>.
              </div>
              <p>Este é um lembrete antecipado para que você possa se organizar e manter seu acesso ativo sem interrupções.</p>
              <p><strong>Valor:</strong> R$ 17,50/mês</p>
              <p>Você pode fazer o pagamento via PIX através do nosso sistema. É rápido e seu acesso será renovado automaticamente!</p>
              <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://vectorpro.replit.app'}" class="button">Acessar Sistema e Pagar</a>
              <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
                ✅ Após o pagamento, seu acesso será renovado automaticamente até o dia 5 do próximo mês.
              </p>
            </div>
            <div class="footer">
              <p>VectorPro - Gestão de Credenciais</p>
              <p>Precisa de ajuda? Entre em contato via WhatsApp: +55 44 93618-4613</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  // Dia 4: Aviso de vencimento amanhã
  paymentDueTomorrow: (userName: string) => ({
    subject: '⚠️ Sua mensalidade vence amanhã - VectorPro',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .warning { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ VectorPro</h1>
            </div>
            <div class="content">
              <h2>Olá${userName ? ' ' + userName : ''}!</h2>
              <div class="warning">
                <strong>⚠️ Atenção:</strong> Sua mensalidade vence <strong>amanhã (dia 5)</strong>!
              </div>
              <p>Este é o último aviso antes do vencimento. Para evitar bloqueio do seu acesso, realize o pagamento o quanto antes.</p>
              <p><strong>Valor:</strong> R$ 17,50/mês</p>
              <p><strong>Vencimento:</strong> Dia 5 (amanhã)</p>
              <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://vectorpro.replit.app'}" class="button">Pagar Agora via PIX</a>
              <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
                ⏰ Pagamentos após o vencimento resultarão em bloqueio temporário do acesso.
              </p>
            </div>
            <div class="footer">
              <p>VectorPro - Gestão de Credenciais</p>
              <p>Precisa de ajuda? Entre em contato via WhatsApp: +55 44 93618-4613</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  // Dia 6: Acesso bloqueado por falta de pagamento
  accessBlocked: (userName: string) => ({
    subject: '🔒 Acesso bloqueado - Pagamento em atraso - VectorPro',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fef2f2; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .blocked { background: #fee2e2; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 VectorPro</h1>
            </div>
            <div class="content">
              <h2>Olá${userName ? ' ' + userName : ''}!</h2>
              <div class="blocked">
                <strong>🔒 Acesso Bloqueado:</strong> Seu acesso foi bloqueado devido ao pagamento em atraso.
              </div>
              <p>Identificamos que sua mensalidade com vencimento no dia 5 ainda não foi paga. Por isso, seu acesso ao sistema foi temporariamente bloqueado.</p>
              <p><strong>Para reativar seu acesso:</strong></p>
              <ol>
                <li>Acesse o sistema e faça o pagamento via PIX</li>
                <li>Seu acesso será reativado automaticamente após a confirmação do pagamento</li>
              </ol>
              <p><strong>Valor:</strong> R$ 17,50/mês</p>
              <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://vectorpro.replit.app'}" class="button">Reativar Acesso Agora</a>
              <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
                💡 Após o pagamento, seu acesso será liberado imediatamente e renovado até o dia 5 do próximo mês.
              </p>
            </div>
            <div class="footer">
              <p>VectorPro - Gestão de Credenciais</p>
              <p>Precisa de ajuda? Entre em contato via WhatsApp: +55 44 93618-4613</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  // Email de criação de senha (password creation flow)
  createPassword: (userEmail: string, token: string) => ({
    subject: '🔐 Crie sua senha de acesso - VectorPro',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .logo { font-size: 48px; margin-bottom: 10px; }
            .content { background: #f0f9ff; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .info-box { background: #dbeafe; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6; }
            .warning-box { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🔐</div>
              <h1 style="margin: 10px 0;">VectorPro</h1>
              <p style="margin: 0; opacity: 0.95;">Bem-vindo ao Sistema!</p>
            </div>
            <div class="content">
              <h2>Olá!</h2>
              <p>Uma conta foi criada para você no sistema VectorPro. Para acessar, você precisa criar sua senha.</p>
              
              <div class="info-box">
                <strong>📧 Email da conta:</strong> ${userEmail}
              </div>

              <p><strong>Próximos passos:</strong></p>
              <ol>
                <li>Clique no botão abaixo para criar sua senha</li>
                <li>Escolha uma senha segura (mínimo 6 caracteres)</li>
                <li>Faça login no sistema com seu email e senha</li>
              </ol>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://vectorpro.replit.app'}/criar-senha?token=${token}" class="button" style="color: #ffffff;">
                  ✨ Criar Minha Senha
                </a>
              </div>

              <div class="warning-box">
                <strong>⏰ Importante:</strong> Este link é válido por <strong>24 horas</strong>. Após esse período, você precisará solicitar um novo link ao administrador.
              </div>

              <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                Se você não solicitou acesso ao VectorPro, ignore este email ou entre em contato conosco.
              </p>
            </div>
            <div class="footer">
              <p><strong>VectorPro</strong> - Gestão de Credenciais</p>
              <p>Precisa de ajuda? Entre em contato via WhatsApp: <strong>+55 44 93618-4613</strong></p>
              <p style="font-size: 12px; color: #9ca3af; margin-top: 15px;">
                Este email foi enviado automaticamente. Por favor, não responda.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),
};
