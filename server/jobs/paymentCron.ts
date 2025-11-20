import cron from 'node-cron';
import { storage } from '../storage';
import { sendEmail, emailTemplates } from '../utils/email';
import { DEFAULT_SERVICE_ID, REMOVEBG_SERVICE_ID, REMOVEBG_PLANS } from '@shared/constants';
import { removeBgService } from '../services/removebg.service';

/**
 * Payment Monitoring Cron Jobs
 * 
 * ALL PAYMENTS ARE DUE ON DAY 5 OF EACH MONTH (standardized billing cycle)
 * Automatically sends email notifications and blocks overdue users.
 * 
 * Schedule (Brazilian timezone - America/Sao_Paulo):
 * - Day 3 at 9:00 AM: "Your payment is due in 2 days" (pre-reminder)
 * - Day 4 at 9:00 AM: "Your payment is due tomorrow" (final warning)
 * - Day 6 at 9:00 AM: Block overdue users + send "Access blocked" (1 day grace period)
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
 * Check if user's payment is due THIS MONTH (day 5 of current month)
 * Used for day 3 and day 4 reminders
 */
function isPaymentDueThisMonth(nextPaymentDate: Date | string | null | undefined): boolean {
  const paymentDate = toDate(nextPaymentDate);
  if (!paymentDate) return false;
  
  const today = new Date();
  const payment = new Date(paymentDate);
  
  // Check if nextPaymentDate is day 5 of the CURRENT month/year
  return (
    payment.getFullYear() === today.getFullYear() &&
    payment.getMonth() === today.getMonth() &&
    payment.getDate() === 5
  );
}

/**
 * Check if payment is overdue (nextPaymentDate is in the past)
 * Used for day 6 blocking
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
 * DAY 3 at 9:00 AM - Send "Payment due in 2 days" email (pre-reminder)
 * All payments due on day 5, so this runs on day 3
 */
async function sendPaymentPreReminderEmails() {
  console.log('🔔 [CRON] Running payment pre-reminder check (Day 3 - due in 2 days)...');
  
  try {
    // Get all active UserServices for vectorizer-001
    const userServices = await storage.getUserServicesByServiceId(DEFAULT_SERVICE_ID);
    const activeUserServices = userServices.filter(us => us.status === 'ATIVO');
    
    console.log(`   Found ${activeUserServices.length} active user services to check`);
    
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const userService of activeUserServices) {
      // Check if user service payment is due day 5 of THIS month
      if (isPaymentDueThisMonth(userService.proximoPagamento)) {
        // Get user to send email
        const user = await storage.getUser(userService.userId);
        if (!user) {
          console.warn(`   User ${userService.userId} not found for UserService ${userService.id}`);
          skippedCount++;
          continue;
        }

        const template = emailTemplates.paymentDueInTwoDays(user.email.split('@')[0]);
        const success = await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
        });

        if (success) {
          sentCount++;
          console.log(`   📧 Sent pre-reminder email to ${user.email} (payment due in 2 days - day 5)`);
        } else {
          failedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`✅ [CRON] Payment pre-reminder emails completed: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped`);
  } catch (error) {
    console.error('❌ [CRON ERROR] Payment pre-reminder check failed:', error);
  }
}

/**
 * DAY 4 at 9:00 AM - Send "Payment due tomorrow" email (final warning)
 * All payments due on day 5, so this runs on day 4
 */
async function sendPaymentFinalWarningEmails() {
  console.log('🔔 [CRON] Running payment final warning check (Day 4 - due tomorrow)...');
  
  try {
    // Get all active UserServices for vectorizer-001
    const userServices = await storage.getUserServicesByServiceId(DEFAULT_SERVICE_ID);
    const activeUserServices = userServices.filter(us => us.status === 'ATIVO');
    
    console.log(`   Found ${activeUserServices.length} active user services to check`);
    
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const userService of activeUserServices) {
      // Check if user service payment is due day 5 of THIS month
      if (isPaymentDueThisMonth(userService.proximoPagamento)) {
        // Get user to send email
        const user = await storage.getUser(userService.userId);
        if (!user) {
          console.warn(`   User ${userService.userId} not found for UserService ${userService.id}`);
          skippedCount++;
          continue;
        }

        const template = emailTemplates.paymentDueTomorrow(user.email.split('@')[0]);
        const success = await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
        });

        if (success) {
          sentCount++;
          console.log(`   📧 Sent final warning email to ${user.email} (payment due tomorrow - day 5)`);
        } else {
          failedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`✅ [CRON] Payment final warning emails completed: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped`);
  } catch (error) {
    console.error('❌ [CRON ERROR] Payment final warning check failed:', error);
  }
}

/**
 * DAY 5 at 1:00 AM - Renew RemoveBG credits for active subscribers
 * Runs early on payment due day to ensure credits are available
 */
async function renewRemoveBGCredits() {
  console.log('🔄 [CRON] Running RemoveBG credit renewal (Day 5)...');
  
  try {
    // Get all active UserServices for RemoveBG service
    const userServices = await storage.getUserServicesByServiceId(REMOVEBG_SERVICE_ID);
    const activeUserServices = userServices.filter(us => us.status === 'ATIVO');
    
    console.log(`   Found ${activeUserServices.length} active RemoveBG subscriptions to renew`);
    
    let renewedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const userService of activeUserServices) {
      // Check if renewal is due on day 5 of THIS month
      if (isPaymentDueThisMonth(userService.proximoPagamento)) {
        // Find the plan details
        const plan = REMOVEBG_PLANS.find(p => p.id === userService.planId);
        if (!plan) {
          console.warn(`   Plan ${userService.planId} not found for UserService ${userService.id}`);
          failedCount++;
          continue;
        }

        // Get user for logging
        const user = await storage.getUser(userService.userId);
        const userEmail = user?.email || `User ${userService.userId}`;

        // Reset credits to plan amount
        const updatedUserService = await storage.updateUserService(userService.id, {
          creditsAvailable: plan.credits,
        });

        if (updatedUserService) {
          renewedCount++;
          console.log(`   ✅ Renewed ${plan.credits} credits for ${userEmail} (Plan: ${plan.name})`);
        } else {
          failedCount++;
          console.error(`   Failed to renew credits for ${userEmail}`);
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`✅ [CRON] RemoveBG credit renewal completed: ${renewedCount} renewed, ${failedCount} failed, ${skippedCount} skipped`);
  } catch (error) {
    console.error('❌ [CRON ERROR] RemoveBG credit renewal failed:', error);
  }
}

/**
 * DAY 6 at 9:00 AM - Block users and send "Access blocked" email
 * Blocks users whose payment is overdue (proximoPagamento < today)
 */
async function blockOverdueUsers() {
  console.log('🔔 [CRON] Running overdue payment check...');
  
  try {
    // Get all active UserServices for vectorizer-001
    const userServices = await storage.getUserServicesByServiceId(DEFAULT_SERVICE_ID);
    const activeUserServices = userServices.filter(us => us.status === 'ATIVO');
    
    console.log(`   Found ${activeUserServices.length} active user services to check`);
    
    let blockedCount = 0;
    let emailsSent = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const userService of activeUserServices) {
      // Check if user service's proximoPagamento is in the past (overdue)
      if (isPaymentOverdue(userService.proximoPagamento)) {
        // Get user for email and compatibility update
        const user = await storage.getUser(userService.userId);
        if (!user) {
          console.warn(`   User ${userService.userId} not found for UserService ${userService.id}`);
          skippedCount++;
          continue;
        }

        // Update UserService status to BLOQUEADO and clear proximoPagamento
        const updatedUserService = await storage.updateUserService(userService.id, {
          status: 'BLOQUEADO',
          proximoPagamento: null, // Clear to prevent re-processing
        });

        // Also update User status for compatibility
        const updatedUser = await storage.updateUser(userService.userId, {
          status: 'BLOQUEADO',
          nextPaymentDate: null, // Clear to prevent re-processing
        });

        if (updatedUserService && updatedUser) {
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

          const dueDateStr = toDate(userService.proximoPagamento)?.toISOString().split('T')[0] || 'unknown';
          console.log(`   🚫 Blocked user: ${user.email} (UserService & User status → PENDENTE, payment was due: ${dueDateStr})`);
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
 * Clean up old RemoveBG images (older than 7 days)
 * Runs daily to free up storage space
 */
async function cleanupOldRemoveBgImages() {
  console.log('🧹 [CRON] Running RemoveBG image cleanup (removing images older than 7 days)...');
  
  try {
    const deletedCount = await removeBgService.cleanupOldImages(7);
    
    if (deletedCount > 0) {
      console.log(`   ✅ Cleaned up ${deletedCount} old RemoveBG images`);
    } else {
      console.log('   ℹ️  No old images to clean up');
    }
  } catch (error) {
    console.error('❌ [CRON ERROR] RemoveBG image cleanup failed:', error);
  }
}

/**
 * Clean up old pending payments (older than 24 hours)
 * Runs daily to avoid polluting payment history with expired payments
 */
async function cleanupOldPendingPayments() {
  console.log('🧹 [CRON] Running pending payment cleanup (expiring payments older than 24 hours)...');
  
  try {
    // Expire all pending payments older than 24 hours
    await storage.expireAllOldPendingPayments(24 * 60 * 60 * 1000);
    console.log('   ✅ Expired all pending payments older than 24 hours');
    
    // Log some stats for monitoring
    const allPayments = await storage.getAllPayments();
    const pendingCount = allPayments.filter(p => p.status === 'pending').length;
    const expiredCount = allPayments.filter(p => p.status === 'expired' || p.status === 'canceled_by_system').length;
    
    console.log(`   📊 Payment stats: ${pendingCount} pending, ${expiredCount} expired/canceled`);
  } catch (error) {
    console.error('❌ [CRON ERROR] Pending payment cleanup failed:', error);
  }
}

/**
 * Initialize all payment monitoring cron jobs
 * All payments due on DAY 5 of each month
 * Safe to call even if cron environment is not ideal
 */
export function initializePaymentCron() {
  console.log('⏰ [CRON] Initializing payment monitoring cron jobs...');
  console.log('   📅 All payments are due on DAY 5 of each month');
  
  try {
    // DAY 3 at 9:00 AM - Payment due in 2 days (pre-reminder)
    cron.schedule('0 9 3 * *', sendPaymentPreReminderEmails, {
      timezone: 'America/Sao_Paulo',
    });
    console.log('   ✅ Scheduled: Day 3, 9:00 AM - Pre-reminder emails (payment due in 2 days)');

    // DAY 4 at 9:00 AM - Payment due tomorrow (final warning)
    cron.schedule('0 9 4 * *', sendPaymentFinalWarningEmails, {
      timezone: 'America/Sao_Paulo',
    });
    console.log('   ✅ Scheduled: Day 4, 9:00 AM - Final warning emails (payment due tomorrow)');

    // DAY 5 at 1:00 AM - Renew RemoveBG credits
    cron.schedule('0 1 5 * *', renewRemoveBGCredits, {
      timezone: 'America/Sao_Paulo',
    });
    console.log('   ✅ Scheduled: Day 5, 1:00 AM - RemoveBG credit renewal');

    // DAY 6 at 9:00 AM - Block overdue users (1 day grace period after day 5)
    cron.schedule('0 9 6 * *', blockOverdueUsers, {
      timezone: 'America/Sao_Paulo',
    });
    console.log('   ✅ Scheduled: Day 6, 9:00 AM - Block overdue users');

    // DAILY at 2:00 AM - Clean up old RemoveBG images (older than 7 days)
    cron.schedule('0 2 * * *', cleanupOldRemoveBgImages, {
      timezone: 'America/Sao_Paulo',
    });
    console.log('   ✅ Scheduled: Daily, 2:00 AM - RemoveBG image cleanup (7+ days old)');

    // DAILY at 3:00 AM - Clean up old pending payments (older than 24 hours)
    cron.schedule('0 3 * * *', cleanupOldPendingPayments, {
      timezone: 'America/Sao_Paulo',
    });
    console.log('   ✅ Scheduled: Daily, 3:00 AM - Pending payment cleanup (24+ hours old)');

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
  sendPaymentPreReminderEmails,
  sendPaymentFinalWarningEmails,
  blockOverdueUsers,
  renewRemoveBGCredits,
  cleanupOldPendingPayments,
};
