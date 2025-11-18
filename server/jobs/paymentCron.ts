import cron from 'node-cron';
import { storage } from '../storage';
import { sendEmail, emailTemplates } from '../utils/email';

/**
 * Payment Monitoring Cron Jobs
 * 
 * Automatically sends email notifications about payment due dates
 * and blocks users who haven't paid by day 6.
 * 
 * Schedule (Brazilian timezone):
 * - Day 4 at 9:00 AM: "Your payment is due tomorrow"
 * - Day 5 at 9:00 AM: "Your payment is due today"
 * - Day 6 at 9:00 AM: Block user and send "Access blocked"
 */

/**
 * Safely convert nextPaymentDate (Date | string | null) to Date object
 * Handles both Date objects and ISO strings from database
 */
function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  try {
    const date = new Date(value);
    // Check if date is valid
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/**
 * Check if payment is due tomorrow (nextPaymentDate is tomorrow)
 */
function isPaymentDueTomorrow(nextPaymentDate: Date | string | null | undefined): boolean {
  const paymentDate = toDate(nextPaymentDate);
  if (!paymentDate) return false;
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0); // Start of day
  
  const payment = new Date(paymentDate);
  payment.setHours(0, 0, 0, 0); // Start of day
  
  return payment.getTime() === tomorrow.getTime();
}

/**
 * Check if payment is due today (nextPaymentDate is today)
 */
function isPaymentDueToday(nextPaymentDate: Date | string | null | undefined): boolean {
  const paymentDate = toDate(nextPaymentDate);
  if (!paymentDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of day
  
  const payment = new Date(paymentDate);
  payment.setHours(0, 0, 0, 0); // Start of day
  
  return payment.getTime() === today.getTime();
}

/**
 * Check if payment is overdue (nextPaymentDate is in the past)
 */
function isPaymentOverdue(nextPaymentDate: Date | string | null | undefined): boolean {
  const paymentDate = toDate(nextPaymentDate);
  if (!paymentDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of day
  
  const payment = new Date(paymentDate);
  payment.setHours(0, 0, 0, 0); // Start of day
  
  return payment.getTime() < today.getTime();
}

/**
 * DAY 4 at 9:00 AM - Send "Payment due tomorrow" email
 * Checks EACH user's individual nextPaymentDate
 */
async function sendPaymentDueTomorrowEmails() {
  console.log('🔔 [CRON] Running payment due tomorrow check...');
  
  try {
    const users = await storage.getAllUsers();
    const activeUsers = users.filter(user => user.status === 'ATIVO');
    
    console.log(`   Found ${activeUsers.length} active users to check`);
    
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const user of activeUsers) {
      // Check if user's individual nextPaymentDate is tomorrow
      if (isPaymentDueTomorrow(user.nextPaymentDate)) {
        const template = emailTemplates.paymentDueTomorrow(user.email.split('@')[0]);
        const success = await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
        });

        if (success) {
          sentCount++;
          console.log(`   📧 Sent "due tomorrow" email to ${user.email}`);
        } else {
          failedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`✅ [CRON] Payment due tomorrow emails completed: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped (not due tomorrow)`);
  } catch (error) {
    console.error('❌ [CRON ERROR] Payment due tomorrow check failed:', error);
  }
}

/**
 * DAY 5 at 9:00 AM - Send "Payment due today" email
 * Checks EACH user's individual nextPaymentDate
 */
async function sendPaymentDueTodayEmails() {
  console.log('🔔 [CRON] Running payment due today check...');
  
  try {
    const users = await storage.getAllUsers();
    const activeUsers = users.filter(user => user.status === 'ATIVO');
    
    console.log(`   Found ${activeUsers.length} active users to check`);
    
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const user of activeUsers) {
      // Check if user's individual nextPaymentDate is today
      if (isPaymentDueToday(user.nextPaymentDate)) {
        const template = emailTemplates.paymentDueToday(user.email.split('@')[0]);
        const success = await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
        });

        if (success) {
          sentCount++;
          console.log(`   📧 Sent "due today" email to ${user.email}`);
        } else {
          failedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`✅ [CRON] Payment due today emails completed: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped (not due today)`);
  } catch (error) {
    console.error('❌ [CRON ERROR] Payment due today check failed:', error);
  }
}

/**
 * DAY 6 at 9:00 AM - Block users and send "Access blocked" email
 * Checks EACH user's individual nextPaymentDate
 */
async function blockOverdueUsers() {
  console.log('🔔 [CRON] Running overdue payment check...');
  
  try {
    const users = await storage.getAllUsers();
    const activeUsers = users.filter(user => user.status === 'ATIVO');
    
    console.log(`   Found ${activeUsers.length} active users to check`);
    
    let blockedCount = 0;
    let emailsSent = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const user of activeUsers) {
      // Check if user's individual nextPaymentDate is in the past (overdue)
      if (isPaymentOverdue(user.nextPaymentDate)) {
        // Update user status to PENDENTE (blocked) and clear nextPaymentDate
        // Clearing prevents repeated blocking emails on subsequent runs
        const updated = await storage.updateUser(user.id, {
          status: 'PENDENTE',
          nextPaymentDate: null, // Clear to prevent re-processing
        });

        if (updated) {
          blockedCount++;
          
          // Send access blocked email
          const template = emailTemplates.accessBlocked(user.email.split('@')[0]);
          const success = await sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
          });

          if (success) {
            emailsSent++;
          } else {
            failedCount++;
          }

          const dueDateStr = toDate(user.nextPaymentDate)?.toISOString().split('T')[0] || 'unknown';
          console.log(`   🚫 Blocked user: ${user.email} (status → PENDENTE, payment was due: ${dueDateStr})`);
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`✅ [CRON] Overdue payment check completed: ${blockedCount} users blocked, ${emailsSent} emails sent, ${failedCount} failed, ${skippedCount} skipped (not overdue)`);
  } catch (error) {
    console.error('❌ [CRON ERROR] Overdue payment check failed:', error);
  }
}

/**
 * Initialize all payment monitoring cron jobs
 * Safe to call even if cron environment is not ideal
 */
export function initializePaymentCron() {
  console.log('⏰ [CRON] Initializing payment monitoring cron jobs...');
  
  try {
    // DAY 4 at 9:00 AM - Payment due tomorrow
    cron.schedule('0 9 4 * *', sendPaymentDueTomorrowEmails, {
      timezone: 'America/Sao_Paulo',
    });
    console.log('   ✅ Scheduled: Day 4, 9:00 AM - Payment due tomorrow emails');

    // DAY 5 at 9:00 AM - Payment due today
    cron.schedule('0 9 5 * *', sendPaymentDueTodayEmails, {
      timezone: 'America/Sao_Paulo',
    });
    console.log('   ✅ Scheduled: Day 5, 9:00 AM - Payment due today emails');

    // DAY 6 at 9:00 AM - Block overdue users
    cron.schedule('0 9 6 * *', blockOverdueUsers, {
      timezone: 'America/Sao_Paulo',
    });
    console.log('   ✅ Scheduled: Day 6, 9:00 AM - Block overdue users');

    console.log('✅ [CRON] All payment monitoring jobs initialized successfully');
    console.log('   ⚠️  Note: Cron jobs only run while the server is active.');
    console.log('   ⚠️  For 24/7 execution, upgrade to Always-On or Reserved VM.');
  } catch (error) {
    console.error('❌ [CRON ERROR] Failed to initialize cron jobs:', error);
    console.error('   Server will continue running, but automated emails will not work.');
  }
}

/**
 * Manual trigger functions for testing
 * (Can be called from API endpoints)
 */
export const manualTriggers = {
  sendPaymentDueTomorrowEmails,
  sendPaymentDueTodayEmails,
  blockOverdueUsers,
};
