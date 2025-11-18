import { Resend } from 'resend';

// Initialize Resend client (only if API key is available)
let resend: Resend | null = null;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('⚠️  WARNING: RESEND_API_KEY not configured - emails will not be sent!');
  console.warn('   Set up Resend integration in Replit to enable email notifications.');
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send email using Resend
 * Returns true if sent successfully, false otherwise
 * Safe to call even if Resend is not configured (will log warning)
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, html } = options;

  // If Resend is not configured, log and return false
  if (!resend) {
    console.warn(`📧 [EMAIL DISABLED] Would send to ${to}: ${subject}`);
    console.warn('   Configure RESEND_API_KEY to enable email sending.');
    return false;
  }

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'VectorPro <noreply@resend.dev>',
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
  } catch (error) {
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
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✨ VectorPro</h1>
            </div>
            <div class="content">
              <h2>Olá${userName ? ' ' + userName : ''}!</h2>
              <p>Este é um lembrete amigável de que sua mensalidade <strong>vence amanhã (dia 5)</strong>.</p>
              <p>Para manter seu acesso ativo, faça o pagamento através do PIX disponível no sistema.</p>
              <p><strong>Valor:</strong> R$ 17,50/mês</p>
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

  // Dia 5: Vence hoje
  paymentDueToday: (userName: string) => ({
    subject: '🔔 Sua mensalidade vence HOJE - VectorPro',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fef3c7; padding: 30px; border-radius: 0 0 8px 8px; border-left: 4px solid #f59e0b; }
            .button { display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .urgent { background: #fee2e2; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ef4444; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✨ VectorPro</h1>
            </div>
            <div class="content">
              <h2>Olá${userName ? ' ' + userName : ''}!</h2>
              <div class="urgent">
                <strong>⚠️ ATENÇÃO:</strong> Sua mensalidade vence <strong>HOJE (dia 5)</strong>!
              </div>
              <p>Para evitar a interrupção do seu acesso, faça o pagamento o quanto antes através do PIX.</p>
              <p><strong>Valor:</strong> R$ 17,50/mês</p>
              <p style="color: #dc2626;"><strong>Se não pagar até amanhã, seu acesso será bloqueado automaticamente.</strong></p>
              <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://vectorpro.replit.app'}" class="button">Pagar Agora via PIX</a>
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

  // Dia 6: Bloqueado
  accessBlocked: (userName: string) => ({
    subject: '🚫 Seu acesso foi bloqueado - VectorPro',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fee2e2; padding: 30px; border-radius: 0 0 8px 8px; border-left: 4px solid #dc2626; }
            .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .blocked { background: #fecaca; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚫 Acesso Bloqueado</h1>
            </div>
            <div class="content">
              <h2>Olá${userName ? ' ' + userName : ''},</h2>
              <div class="blocked">
                <h3 style="color: #dc2626; margin: 0;">Seu acesso foi bloqueado por falta de pagamento.</h3>
              </div>
              <p>Infelizmente, como a mensalidade não foi paga no prazo, seu acesso ao sistema VectorPro foi suspenso.</p>
              <p><strong>Para reativar seu acesso:</strong></p>
              <ol>
                <li>Faça o pagamento da mensalidade (R$ 17,50) via PIX</li>
                <li>Seu acesso será reativado automaticamente após confirmação</li>
                <li>Você terá mais 30 dias de acesso completo</li>
              </ol>
              <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://vectorpro.replit.app'}" class="button">Pagar e Reativar Acesso</a>
              <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                💬 Tem alguma dúvida? Entre em contato conosco pelo WhatsApp: +55 44 93618-4613
              </p>
            </div>
            <div class="footer">
              <p>VectorPro - Gestão de Credenciais</p>
              <p>Estamos aqui para ajudar!</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),
};
