// ============================================
// Authentication Flows Test Suite
// ============================================

const BASE_URL = 'http://localhost:5000';
const RESULTS = {
  clientLogin: { tests: [] },
  adminLogin: { tests: [] },
  registration: { tests: [] },
  passwordReset: { tests: [] },
  sessionManagement: { tests: [] }
};

// Utility function to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Important for cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await response.json().catch(() => null);
  
  return {
    ok: response.ok,
    status: response.status,
    data,
    headers: response.headers
  };
}

// ============================================
// 1. CLIENT LOGIN TESTS
// ============================================
async function testClientLogin() {
  console.log('\n🔐 TESTING CLIENT LOGIN FLOW...\n');
  
  // Test 1.1: Valid credentials with teste123
  console.log('📝 Test 1.1: Valid client credentials (teste123)');
  let result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'cliente@example.com',
      password: 'teste123'
    })
  });
  
  let test1_1 = {
    name: 'Valid credentials (teste123)',
    passed: result.ok && result.data?.user?.email === 'cliente@example.com',
    details: result.ok ? 'Login successful' : `Failed: ${result.data?.error || 'Unknown error'}`,
    status: result.status
  };
  RESULTS.clientLogin.tests.push(test1_1);
  console.log(test1_1.passed ? '✅ PASSED' : '❌ FAILED', test1_1.details);
  
  // Save session for later tests
  let clientSession = null;
  if (result.ok) {
    clientSession = result.headers.get('set-cookie');
  }
  
  // Logout before next test
  await apiRequest('/api/auth/logout', { method: 'POST' });
  
  // Test 1.2: Try with wrong password "cliente123"
  console.log('\n📝 Test 1.2: Testing with wrong password (cliente123)');
  result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'cliente@example.com',
      password: 'cliente123'
    })
  });
  
  let test1_2 = {
    name: 'Testing with wrong password',
    passed: !result.ok && result.status === 401,
    details: result.ok ? 'Unexpected success' : `Correctly rejected: ${result.data?.error}`,
    status: result.status
  };
  RESULTS.clientLogin.tests.push(test1_2);
  console.log(test1_2.passed ? '✅ PASSED' : '❌ FAILED', test1_2.details);
  
  // Test 1.3: Invalid email
  console.log('\n📝 Test 1.3: Invalid email');
  result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'invalid@example.com',
      password: 'cliente123'
    })
  });
  
  let test1_3 = {
    name: 'Invalid email',
    passed: result.status === 401,
    details: `Status: ${result.status}, Error: ${result.data?.error}`,
    status: result.status
  };
  RESULTS.clientLogin.tests.push(test1_3);
  console.log(test1_3.passed ? '✅ PASSED' : '❌ FAILED', test1_3.details);
  
  // Test 1.4: Invalid password
  console.log('\n📝 Test 1.4: Invalid password');
  result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'cliente@example.com',
      password: 'wrongpassword'
    })
  });
  
  let test1_4 = {
    name: 'Invalid password',
    passed: result.status === 401,
    details: `Status: ${result.status}, Error: ${result.data?.error}`,
    status: result.status
  };
  RESULTS.clientLogin.tests.push(test1_4);
  console.log(test1_4.passed ? '✅ PASSED' : '❌ FAILED', test1_4.details);
  
  // Test 1.5: Session creation and React Query cache
  console.log('\n📝 Test 1.5: Session creation and /api/auth/me endpoint');
  // First login
  result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'cliente@example.com',
      password: 'teste123'
    })
  });
  
  if (result.ok) {
    // Test /api/auth/me endpoint
    const meResult = await apiRequest('/api/auth/me');
    
    let test1_5 = {
      name: 'Session created and /api/auth/me works',
      passed: meResult.ok && meResult.data?.user?.email === 'cliente@example.com',
      details: meResult.ok ? 'Session validated successfully' : 'Session validation failed',
      status: meResult.status
    };
    RESULTS.clientLogin.tests.push(test1_5);
    console.log(test1_5.passed ? '✅ PASSED' : '❌ FAILED', test1_5.details);
    
    // Cleanup - logout
    await apiRequest('/api/auth/logout', { method: 'POST' });
  }
}

// ============================================
// 2. ADMIN LOGIN TESTS
// ============================================
async function testAdminLogin() {
  console.log('\n🛡️ TESTING ADMIN LOGIN FLOW...\n');
  
  // Test 2.1: Valid admin credentials
  console.log('📝 Test 2.1: Valid admin credentials');
  let result = await apiRequest('/api/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'admin123'
    })
  });
  
  let test2_1 = {
    name: 'Valid admin credentials',
    passed: result.ok && result.data?.user?.isAdmin === 'true',
    details: result.ok ? 'Admin login successful' : `Failed: ${result.data?.error}`,
    status: result.status
  };
  RESULTS.adminLogin.tests.push(test2_1);
  console.log(test2_1.passed ? '✅ PASSED' : '❌ FAILED', test2_1.details);
  
  // Test admin role enforcement
  if (result.ok) {
    const meResult = await apiRequest('/api/auth/me');
    let test2_2 = {
      name: 'Admin role enforcement',
      passed: meResult.data?.user?.isAdmin === 'true',
      details: meResult.data?.user?.isAdmin === 'true' ? 'Admin role verified' : 'Admin role not set',
      status: meResult.status
    };
    RESULTS.adminLogin.tests.push(test2_2);
    console.log(test2_2.passed ? '✅ PASSED' : '❌ FAILED', test2_2.details);
  }
  
  // Logout
  await apiRequest('/api/auth/logout', { method: 'POST' });
  
  // Test 2.3: Non-admin user trying admin login
  console.log('\n📝 Test 2.3: Non-admin user trying admin login');
  result = await apiRequest('/api/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'cliente@example.com',
      password: 'teste123'
    })
  });
  
  let test2_3 = {
    name: 'Non-admin user rejected from admin login',
    passed: result.status === 401,
    details: `Status: ${result.status}, Error: ${result.data?.error}`,
    status: result.status
  };
  RESULTS.adminLogin.tests.push(test2_3);
  console.log(test2_3.passed ? '✅ PASSED' : '❌ FAILED', test2_3.details);
  
  // Test 2.4: Invalid admin credentials
  console.log('\n📝 Test 2.4: Invalid admin password');
  result = await apiRequest('/api/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'wrongpassword'
    })
  });
  
  let test2_4 = {
    name: 'Invalid admin password',
    passed: result.status === 401,
    details: `Status: ${result.status}, Error: ${result.data?.error}`,
    status: result.status
  };
  RESULTS.adminLogin.tests.push(test2_4);
  console.log(test2_4.passed ? '✅ PASSED' : '❌ FAILED', test2_4.details);
}

// ============================================
// 3. REGISTRATION FLOW TESTS
// ============================================
async function testRegistration() {
  console.log('\n📋 TESTING REGISTRATION FLOW...\n');
  
  // Test 3.1: Register new user
  console.log('📝 Test 3.1: Register new user');
  const testEmail = `test_${Date.now()}@example.com`;
  let result = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail
    })
  });
  
  let test3_1 = {
    name: 'New user registration',
    passed: result.ok && result.data?.success === true,
    details: result.ok ? `Registered: ${testEmail}` : `Failed: ${result.data?.error}`,
    status: result.status,
    testEmail
  };
  RESULTS.registration.tests.push(test3_1);
  console.log(test3_1.passed ? '✅ PASSED' : '❌ FAILED', test3_1.details);
  
  // Test 3.2: Duplicate email prevention (using existing user)
  console.log('\n📝 Test 3.2: Duplicate email prevention (active user)');
  result = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'cliente@example.com' // This user is ATIVO
    })
  });
  
  let test3_2 = {
    name: 'Duplicate email prevention (active user)',
    passed: result.status === 400 && result.data?.error?.includes('já está cadastrado'),
    details: result.data?.error || 'No error message',
    status: result.status
  };
  RESULTS.registration.tests.push(test3_2);
  console.log(test3_2.passed ? '✅ PASSED' : '❌ FAILED', test3_2.details);
  
  // Test 3.3: Re-registration of inactive user should resend email
  console.log('\n📝 Test 3.3: Re-registration resends password creation email');
  // First register a new user
  const inactiveEmail = `inactive_${Date.now()}@example.com`;
  await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: inactiveEmail })
  });
  
  // Try to register again (should resend email)
  result = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: inactiveEmail })
  });
  
  let test3_3 = {
    name: 'Re-registration resends email for inactive user',
    passed: result.ok && result.data?.message?.includes('reenviado'),
    details: result.data?.message || result.data?.error || 'No message',
    status: result.status
  };
  RESULTS.registration.tests.push(test3_3);
  console.log(test3_3.passed ? '✅ PASSED' : '❌ FAILED', test3_3.details);
  
  // Test 3.4: Invalid email format
  console.log('\n📝 Test 3.4: Invalid email format');
  result = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'invalid-email'
    })
  });
  
  let test3_4 = {
    name: 'Invalid email format rejected',
    passed: result.status === 400,
    details: result.data?.error || 'No error message',
    status: result.status
  };
  RESULTS.registration.tests.push(test3_4);
  console.log(test3_4.passed ? '✅ PASSED' : '❌ FAILED', test3_4.details);
}

// ============================================
// 4. PASSWORD RESET/CREATION FLOW TESTS
// ============================================
async function testPasswordFlow() {
  console.log('\n🔑 TESTING PASSWORD CREATION FLOW...\n');
  
  // Test 4.1: Invalid token
  console.log('📝 Test 4.1: Invalid token validation');
  let result = await apiRequest('/api/auth/validate-token/invalid-token-12345');
  
  let test4_1 = {
    name: 'Invalid token rejected',
    passed: result.status === 400,
    details: `Status: ${result.status}, Valid: ${result.data?.valid}`,
    status: result.status
  };
  RESULTS.passwordReset.tests.push(test4_1);
  console.log(test4_1.passed ? '✅ PASSED' : '❌ FAILED', test4_1.details);
  
  // Test 4.2: Create password with invalid token
  console.log('\n📝 Test 4.2: Create password with invalid token');
  result = await apiRequest('/api/auth/create-password', {
    method: 'POST',
    body: JSON.stringify({
      token: 'invalid-token-12345',
      password: 'newpassword123'
    })
  });
  
  let test4_2 = {
    name: 'Password creation with invalid token rejected',
    passed: result.status === 400,
    details: result.data?.error || 'No error message',
    status: result.status
  };
  RESULTS.passwordReset.tests.push(test4_2);
  console.log(test4_2.passed ? '✅ PASSED' : '❌ FAILED', test4_2.details);
  
  // Test 4.3: Password too short
  console.log('\n📝 Test 4.3: Password validation (too short)');
  result = await apiRequest('/api/auth/create-password', {
    method: 'POST',
    body: JSON.stringify({
      token: 'some-token',
      password: '123' // Too short
    })
  });
  
  let test4_3 = {
    name: 'Short password rejected',
    passed: result.status === 400 && result.data?.error?.includes('mínimo'),
    details: result.data?.error || 'No error message',
    status: result.status
  };
  RESULTS.passwordReset.tests.push(test4_3);
  console.log(test4_3.passed ? '✅ PASSED' : '❌ FAILED', test4_3.details);
  
  console.log('\n📝 Note: Complete password reset flow requires email functionality and valid tokens');
}

// ============================================
// 5. SESSION MANAGEMENT TESTS
// ============================================
async function testSessionManagement() {
  console.log('\n🔄 TESTING SESSION MANAGEMENT...\n');
  
  // Test 5.1: Login and verify session cookie
  console.log('📝 Test 5.1: Session cookie creation');
  let result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'cliente@example.com',
      password: 'teste123'
    })
  });
  
  const setCookie = result.headers.get('set-cookie');
  let test5_1 = {
    name: 'Session cookie created on login',
    passed: result.ok && setCookie && setCookie.includes('connect.sid'),
    details: setCookie ? 'Cookie set properly' : 'No cookie found',
    status: result.status
  };
  RESULTS.sessionManagement.tests.push(test5_1);
  console.log(test5_1.passed ? '✅ PASSED' : '❌ FAILED', test5_1.details);
  
  // Test 5.2: Session persistence
  console.log('\n📝 Test 5.2: Session persistence');
  const meResult1 = await apiRequest('/api/auth/me');
  
  let test5_2 = {
    name: 'Session persists across requests',
    passed: meResult1.ok && meResult1.data?.user?.email === 'cliente@example.com',
    details: meResult1.ok ? 'Session valid' : 'Session not found',
    status: meResult1.status
  };
  RESULTS.sessionManagement.tests.push(test5_2);
  console.log(test5_2.passed ? '✅ PASSED' : '❌ FAILED', test5_2.details);
  
  // Test 5.3: Logout functionality
  console.log('\n📝 Test 5.3: Logout functionality');
  const logoutResult = await apiRequest('/api/auth/logout', { method: 'POST' });
  const meResult2 = await apiRequest('/api/auth/me');
  
  let test5_3 = {
    name: 'Logout destroys session',
    passed: logoutResult.ok && meResult2.status === 401,
    details: meResult2.status === 401 ? 'Session destroyed successfully' : 'Session still active',
    status: meResult2.status
  };
  RESULTS.sessionManagement.tests.push(test5_3);
  console.log(test5_3.passed ? '✅ PASSED' : '❌ FAILED', test5_3.details);
  
  // Test 5.4: Concurrent sessions (simulate two browser sessions)
  console.log('\n📝 Test 5.4: Testing concurrent sessions');
  // Login as client
  const clientLogin = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'cliente@example.com',
      password: 'teste123'
    })
  });
  
  // Now try to login as admin (this would be a different session in a real browser)
  // Note: In this test environment, it will override the session
  const adminLogin = await apiRequest('/api/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'admin123'
    })
  });
  
  // Check current session
  const currentSession = await apiRequest('/api/auth/me');
  
  let test5_4 = {
    name: 'Session handling (last login wins)',
    passed: currentSession.data?.user?.email === 'admin@example.com',
    details: `Current session: ${currentSession.data?.user?.email}`,
    status: currentSession.status
  };
  RESULTS.sessionManagement.tests.push(test5_4);
  console.log(test5_4.passed ? '✅ PASSED' : '❌ FAILED', test5_4.details);
  
  // Cleanup
  await apiRequest('/api/auth/logout', { method: 'POST' });
}

// ============================================
// RUN ALL TESTS
// ============================================
async function runAllTests() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   AUTHENTICATION FLOWS TEST SUITE          ║');
  console.log('╚════════════════════════════════════════════╝');
  
  await testClientLogin();
  await testAdminLogin();
  await testRegistration();
  await testPasswordFlow();
  await testSessionManagement();
  
  // Generate summary report
  console.log('\n\n╔════════════════════════════════════════════╗');
  console.log('║            TEST SUMMARY REPORT             ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const [category, data] of Object.entries(RESULTS)) {
    const categoryName = category.replace(/([A-Z])/g, ' $1').toUpperCase();
    const passed = data.tests.filter(t => t.passed).length;
    const failed = data.tests.filter(t => !t.passed).length;
    totalPassed += passed;
    totalFailed += failed;
    
    console.log(`\n${categoryName}:`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('  Failed tests:');
      data.tests.filter(t => !t.passed).forEach(t => {
        console.log(`    - ${t.name}: ${t.details}`);
      });
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('═'.repeat(50));
  
  return {
    passed: totalPassed,
    failed: totalFailed,
    details: RESULTS
  };
}

// Execute tests
runAllTests().then(results => {
  console.log('\n✨ Test suite completed!');
  if (results.failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log(`⚠️  ${results.failed} test(s) failed. Please review the results above.`);
  }
}).catch(error => {
  console.error('❌ Test suite failed:', error);
});