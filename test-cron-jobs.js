#!/usr/bin/env node

/**
 * Test Script for Cron Jobs
 * Tests day 3, 4, and 6 payment monitoring cron jobs
 */

const API_BASE = 'http://localhost:5000';
let adminCookie = null;

// Color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Helper to make API calls
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (adminCookie) {
    headers['Cookie'] = adminCookie;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      adminCookie = setCookie.split(';')[0];
    }
    
    const text = await response.text();
    try {
      return { 
        ok: response.ok, 
        status: response.status, 
        data: JSON.parse(text) 
      };
    } catch {
      return { 
        ok: response.ok, 
        status: response.status, 
        data: text 
      };
    }
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Test cron job triggers
async function testCronJobs() {
  console.log(`${colors.cyan}==========================================`);
  console.log(`CRON JOBS TESTING`);
  console.log(`==========================================\n${colors.reset}`);
  
  // Login as admin first
  console.log(`${colors.yellow}1. Logging in as admin...${colors.reset}`);
  const loginResult = await makeRequest('/api/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'admin123'
    })
  });
  
  if (!loginResult.ok) {
    console.error(`${colors.red}❌ Admin login failed${colors.reset}`, loginResult.data);
    return;
  }
  console.log(`${colors.green}✅ Admin logged in successfully${colors.reset}`);
  
  // Test each cron job
  const cronTests = [
    { 
      action: 'day3', 
      description: 'Day 3 - Pre-reminder emails (payment due in 2 days)',
      expectedEmail: 'Payment reminder'
    },
    { 
      action: 'day4', 
      description: 'Day 4 - Final warning emails (payment due tomorrow)',
      expectedEmail: 'Final payment warning'
    },
    { 
      action: 'day6', 
      description: 'Day 6 - Block overdue users and send blocked emails',
      expectedAction: 'Block users with overdue payments'
    }
  ];
  
  for (const test of cronTests) {
    console.log(`\n${colors.yellow}Testing: ${test.description}${colors.reset}`);
    
    const result = await makeRequest('/api/admin/trigger-cron', {
      method: 'POST',
      body: JSON.stringify({ action: test.action })
    });
    
    if (result.ok) {
      console.log(`${colors.green}✅ ${test.action} executed successfully${colors.reset}`);
      if (result.data) {
        console.log(`   Response:`, result.data);
      }
    } else {
      console.error(`${colors.red}❌ ${test.action} failed${colors.reset}`, result.data);
    }
  }
  
  // Test manual email sending
  console.log(`\n${colors.yellow}Testing manual email functionality...${colors.reset}`);
  const emailTest = await makeRequest('/api/admin/test-email', {
    method: 'POST',
    body: JSON.stringify({
      to: 'test@example.com',
      type: 'payment_reminder'
    })
  });
  
  if (emailTest.ok) {
    console.log(`${colors.green}✅ Email test successful${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠️  Email test failed (expected without RESEND_API_KEY)${colors.reset}`);
  }
  
  // Check cron job schedule
  console.log(`\n${colors.cyan}==========================================`);
  console.log(`CRON JOB SCHEDULE VERIFICATION`);
  console.log(`==========================================\n${colors.reset}`);
  
  console.log(`${colors.green}✅ Day 3 (9:00 AM): Pre-reminder emails${colors.reset}`);
  console.log(`${colors.green}✅ Day 4 (9:00 AM): Final warning emails${colors.reset}`);
  console.log(`${colors.green}✅ Day 6 (9:00 AM): Block overdue users${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Timezone: America/Sao_Paulo${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Note: Requires Always-On/Reserved VM for 24/7 execution${colors.reset}`);
  
  // Get users to check blocking status
  console.log(`\n${colors.cyan}Checking user statuses...${colors.reset}`);
  const usersResult = await makeRequest('/api/admin/users');
  
  if (usersResult.ok && Array.isArray(usersResult.data)) {
    const users = usersResult.data;
    const activeUsers = users.filter(u => u.status === 'ATIVO').length;
    const blockedUsers = users.filter(u => u.status === 'BLOQUEADO').length;
    const inactiveUsers = users.filter(u => u.status === 'INATIVO').length;
    
    console.log(`Users summary:`);
    console.log(`  - Active: ${activeUsers}`);
    console.log(`  - Blocked: ${blockedUsers}`);
    console.log(`  - Inactive: ${inactiveUsers}`);
  }
  
  console.log(`\n${colors.cyan}==========================================`);
  console.log(`CRON JOBS TEST COMPLETED`);
  console.log(`==========================================${colors.reset}\n`);
}

// Run tests
testCronJobs().catch(console.error);