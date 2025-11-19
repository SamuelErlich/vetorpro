#!/usr/bin/env node

/**
 * Comprehensive PushinPay Webhook Testing Script
 * Tests all webhook scenarios including success, failure, idempotency, and error handling
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';
const WEBHOOK_URL = `${BASE_URL}/api/webhook/pushinpay`;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = [];

// Helper function to make webhook requests
async function sendWebhook(payload, headers = {}) {
  try {
    const response = await axios.post(WEBHOOK_URL, payload, { headers });
    return { status: response.status, data: response.data };
  } catch (error) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    throw error;
  }
}

// Helper function to verify payment status in DB
async function verifyPaymentStatus(txid) {
  try {
    const response = await axios.get(`${BASE_URL}/api/admin/payments`);
    const payment = response.data.find(p => p.txid === txid);
    return payment;
  } catch (error) {
    console.error('Error fetching payment:', error.message);
    return null;
  }
}

// Helper function to verify user status
async function verifyUserStatus(userId) {
  try {
    const response = await axios.get(`${BASE_URL}/api/admin/users`);
    const user = response.data.find(u => u.id === userId);
    return user;
  } catch (error) {
    console.error('Error fetching user:', error.message);
    return null;
  }
}

// Test function wrapper
async function runTest(testName, testFn) {
  totalTests++;
  console.log(`\n${colors.cyan}Running: ${testName}${colors.reset}`);
  
  try {
    await testFn();
    passedTests++;
    console.log(`${colors.green}✓ PASSED${colors.reset}`);
  } catch (error) {
    failedTests.push({ test: testName, error: error.message });
    console.log(`${colors.red}✗ FAILED: ${error.message}${colors.reset}`);
  }
}

// Wait function
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main test suite
async function runAllTests() {
  console.log(`\n${colors.magenta}========================================`);
  console.log(`   PushinPay Webhook Comprehensive Tests`);
  console.log(`========================================${colors.reset}\n`);

  // ==================== SCENARIO 1: Test webhook with real payment ====================
  console.log(`\n${colors.blue}=== SCENARIO 1: Real Payment Processing ===${colors.reset}`);

  await runTest('1.1 Confirm pending payment (status=paid)', async () => {
    const payload = {
      status: 'paid',
      txid: 'TEST_PENDING_001',
      amount: 17.50,
      timestamp: new Date().toISOString()
    };
    
    const result = await sendWebhook(payload);
    if (result.status !== 200) throw new Error(`Expected status 200, got ${result.status}`);
    if (!result.data.success) throw new Error('Expected success=true');
    
    await wait(500);
    const payment = await verifyPaymentStatus('TEST_PENDING_001');
    if (payment?.status !== 'paid') throw new Error(`Payment status not updated to 'paid', got ${payment?.status}`);
  });

  await runTest('1.2 Verify user status changes to ATIVO', async () => {
    // Get the payment first
    const payment = await verifyPaymentStatus('TEST_PENDING_001');
    if (!payment) throw new Error('Payment not found');
    
    const user = await verifyUserStatus(payment.userId);
    if (user?.status !== 'ATIVO') throw new Error(`User status not ATIVO, got ${user?.status}`);
    if (!user?.ultimoPagamento) throw new Error('User ultimoPagamento not set');
  });

  // ==================== SCENARIO 2: Test webhook status variations ====================
  console.log(`\n${colors.blue}=== SCENARIO 2: Status Variations ===${colors.reset}`);

  await runTest('2.1 Cancel payment (status=canceled)', async () => {
    const payload = {
      status: 'canceled',
      txid: 'TEST_PENDING_002',
      amount: 17.50
    };
    
    const result = await sendWebhook(payload);
    if (result.status !== 200) throw new Error(`Expected status 200, got ${result.status}`);
    
    await wait(500);
    const payment = await verifyPaymentStatus('TEST_PENDING_002');
    if (payment?.status !== 'failed') throw new Error(`Payment status not 'failed' for canceled, got ${payment?.status}`);
  });

  await runTest('2.2 Fail payment (status=failed)', async () => {
    const payload = {
      status: 'failed',
      txid: 'TEST_PENDING_003'
    };
    
    const result = await sendWebhook(payload);
    if (result.status !== 200) throw new Error(`Expected status 200, got ${result.status}`);
    
    await wait(500);
    const payment = await verifyPaymentStatus('TEST_PENDING_003');
    if (payment?.status !== 'failed') throw new Error(`Payment status not 'failed', got ${payment?.status}`);
  });

  await runTest('2.3 Expire payment (status=expired)', async () => {
    const payload = {
      status: 'expired',
      txid: 'TEST_PENDING_004'
    };
    
    const result = await sendWebhook(payload);
    if (result.status !== 200) throw new Error(`Expected status 200, got ${result.status}`);
    
    await wait(500);
    const payment = await verifyPaymentStatus('TEST_PENDING_004');
    if (payment?.status !== 'failed') throw new Error(`Payment status not 'failed' for expired, got ${payment?.status}`);
  });

  await runTest('2.4 Alternative success status (status=confirmed)', async () => {
    const payload = {
      status: 'confirmed',
      txid: 'TEST_PENDING_005'
    };
    
    const result = await sendWebhook(payload);
    if (result.status !== 200) throw new Error(`Expected status 200, got ${result.status}`);
    
    await wait(500);
    const payment = await verifyPaymentStatus('TEST_PENDING_005');
    if (payment?.status !== 'paid') throw new Error(`Payment not marked as paid for 'confirmed', got ${payment?.status}`);
  });

  // ==================== SCENARIO 3: Test webhook field variations ====================
  console.log(`\n${colors.blue}=== SCENARIO 3: Field Variations ===${colors.reset}`);

  await runTest('3.1 TXID as "id" field', async () => {
    const payload = {
      status: 'paid',
      id: 'PUSHIN_PENDING_002', // Using pushinpay_id as it wasn't paid yet
      amount: 17.50
    };
    
    const result = await sendWebhook(payload);
    if (result.status !== 200) throw new Error(`Expected status 200, got ${result.status}`);
  });

  await runTest('3.2 TXID as "end_to_end_id" field', async () => {
    const payload = {
      status: 'paid',
      end_to_end_id: 'PUSHIN_PENDING_003',
      value: 17.50
    };
    
    const result = await sendWebhook(payload);
    if (result.status !== 200) throw new Error(`Expected status 200, got ${result.status}`);
  });

  await runTest('3.3 TXID as "transaction_id" field', async () => {
    const payload = {
      status: 'paid',
      transaction_id: 'PUSHIN_PENDING_004',
      amount: 17.50
    };
    
    const result = await sendWebhook(payload);
    if (result.status !== 200) throw new Error(`Expected status 200, got ${result.status}`);
  });

  await runTest('3.4 Case insensitive TXID matching (uppercase)', async () => {
    const payload = {
      status: 'paid',
      txid: 'TEST_LOWERCASE_001', // Send uppercase for lowercase in DB
      amount: 17.50
    };
    
    const result = await sendWebhook(payload);
    if (result.status !== 200) throw new Error(`Expected status 200, got ${result.status}`);
    
    await wait(500);
    const payment = await verifyPaymentStatus('test_lowercase_001');
    if (payment?.status !== 'paid') throw new Error(`Case insensitive match failed, status: ${payment?.status}`);
  });

  await runTest('3.5 TXID as "EndToEndId" field (PascalCase)', async () => {
    const payload = {
      status: 'paid',
      EndToEndId: 'PUSHIN_FAILED_001', // Testing with a failed payment
      amount: 17.50
    };
    
    const result = await sendWebhook(payload);
    if (result.status !== 200) throw new Error(`Expected status 200, got ${result.status}`);
  });

  // ==================== SCENARIO 4: Test idempotency ====================
  console.log(`\n${colors.blue}=== SCENARIO 4: Idempotency ===${colors.reset}`);

  await runTest('4.1 Send webhook twice for same payment', async () => {
    // First request
    const payload = {
      status: 'paid',
      txid: 'TEST_PENDING_001', // Already paid in test 1.1
      amount: 17.50
    };
    
    const result1 = await sendWebhook(payload);
    if (result1.status !== 200) throw new Error(`First request: Expected status 200, got ${result1.status}`);
    if (!result1.data.message?.includes('Already processed')) {
      throw new Error(`Expected idempotency response, got: ${result1.data.message}`);
    }
    
    // Second request
    const result2 = await sendWebhook(payload);
    if (result2.status !== 200) throw new Error(`Second request: Expected status 200, got ${result2.status}`);
    if (!result2.data.message?.includes('Already processed')) {
      throw new Error(`Expected idempotency response, got: ${result2.data.message}`);
    }
    
    // Verify payment still has same status
    const payment = await verifyPaymentStatus('TEST_PENDING_001');
    if (payment?.status !== 'paid') throw new Error(`Payment status changed, got ${payment?.status}`);
  });

  // ==================== SCENARIO 5: Test error handling ====================
  console.log(`\n${colors.blue}=== SCENARIO 5: Error Handling ===${colors.reset}`);

  await runTest('5.1 Invalid JSON', async () => {
    try {
      const response = await axios.post(WEBHOOK_URL, 'invalid json {', {
        headers: { 'Content-Type': 'application/json' }
      });
      throw new Error('Should have failed with invalid JSON');
    } catch (error) {
      if (error.response?.status !== 400) {
        throw new Error(`Expected 400 for invalid JSON, got ${error.response?.status}`);
      }
    }
  });

  await runTest('5.2 Missing TXID field', async () => {
    const payload = {
      status: 'paid',
      amount: 17.50
      // No txid or any variant
    };
    
    const result = await sendWebhook(payload);
    if (result.status !== 400) throw new Error(`Expected status 400 for missing TXID, got ${result.status}`);
    if (!result.data.error?.includes('TXID')) throw new Error(`Expected TXID error message`);
  });

  await runTest('5.3 Non-existent payment', async () => {
    const payload = {
      status: 'paid',
      txid: 'NON_EXISTENT_PAYMENT_999',
      amount: 17.50
    };
    
    const result = await sendWebhook(payload);
    if (result.status !== 200) throw new Error(`Expected status 200 (to prevent retries), got ${result.status}`);
    if (!result.data.message?.includes('not found')) {
      throw new Error(`Expected 'not found' message, got: ${result.data.message}`);
    }
  });

  await runTest('5.4 Empty payload', async () => {
    const payload = {};
    
    const result = await sendWebhook(payload);
    if (result.status !== 400) throw new Error(`Expected status 400 for empty payload, got ${result.status}`);
  });

  await runTest('5.5 Null status', async () => {
    const payload = {
      status: null,
      txid: 'TEST_PENDING_001'
    };
    
    const result = await sendWebhook(payload);
    // Null status should be treated as unknown/error
    if (result.status !== 200) throw new Error(`Expected status 200, got ${result.status}`);
  });

  // ==================== Additional Tests ====================
  console.log(`\n${colors.blue}=== Additional Tests ===${colors.reset}`);

  await runTest('6.1 Test with authentication header (if configured)', async () => {
    const payload = {
      status: 'paid',
      txid: 'TEST_PENDING_001'
    };
    
    // Try with fake authentication header
    const headers = {
      'x-token': 'fake-token-12345'
    };
    
    const result = await sendWebhook(payload, headers);
    // Should still work with payload validation even if header is wrong
    if (result.status !== 200) throw new Error(`Expected status 200, got ${result.status}`);
  });

  await runTest('6.2 Test nested TXID field', async () => {
    const payload = {
      status: 'paid',
      payment: {
        txid: 'TEST_PENDING_001'
      }
    };
    
    const result = await sendWebhook(payload);
    // Nested fields are not supported, should fail to find TXID
    if (result.status !== 400) throw new Error(`Expected status 400 for nested TXID, got ${result.status}`);
  });

  // ==================== Summary ====================
  console.log(`\n${colors.magenta}========================================`);
  console.log(`              Test Summary`);
  console.log(`========================================${colors.reset}`);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests.length}${colors.reset}`);
  
  if (failedTests.length > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    failedTests.forEach((failure, index) => {
      console.log(`  ${index + 1}. ${failure.test}`);
      console.log(`     Error: ${failure.error}`);
    });
  }
  
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  console.log(`\n${colors.cyan}Success Rate: ${successRate}%${colors.reset}`);
  
  if (failedTests.length === 0) {
    console.log(`\n${colors.green}🎉 All tests passed successfully!${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}⚠️  Some tests failed. Please review the failures above.${colors.reset}`);
  }
}

// Run tests
console.log(`${colors.yellow}Starting webhook tests...${colors.reset}`);
console.log(`${colors.yellow}Make sure the server is running on port 5000${colors.reset}`);

runAllTests().catch(error => {
  console.error(`\n${colors.red}Fatal error during test execution:${colors.reset}`, error);
  process.exit(1);
});