/**
 * Test script to verify INATIVO user can generate PIX but cannot access credentials
 * Run: node test-inativo-flow.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const TEST_EMAIL = 'test.inativo@example.com';
const TEST_PASSWORD = 'test123456';

// Store cookies for session
let cookies = '';

async function test() {
  console.log('🧪 Testing INATIVO user flow...\n');

  // Step 1: Try to login as INATIVO user (assuming user exists)
  console.log('1️⃣ Attempting login as INATIVO user...');
  try {
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    }, {
      validateStatus: () => true
    });

    if (loginResponse.status === 200) {
      // Extract cookies from response
      const setCookies = loginResponse.headers['set-cookie'];
      if (setCookies) {
        cookies = setCookies.join('; ');
      }
      console.log('✅ Login successful');
      console.log('   User status:', loginResponse.data.user.status);
    } else {
      console.log('❌ Login failed:', loginResponse.data.error);
      console.log('   Note: You need to create a test user with INATIVO status first');
      return;
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return;
  }

  // Step 2: Try to generate PIX (should work for INATIVO)
  console.log('\n2️⃣ Attempting to generate PIX payment...');
  try {
    const pixResponse = await axios.post(`${BASE_URL}/api/payments/pix`, 
      {
        serviceId: 'vectorizer-001'
      },
      {
        headers: {
          'Cookie': cookies
        },
        validateStatus: () => true
      }
    );

    if (pixResponse.status === 200) {
      console.log('✅ PIX generated successfully!');
      console.log('   QR Code:', pixResponse.data.qrCode ? 'Received' : 'Not received');
      console.log('   TXID:', pixResponse.data.txid);
    } else {
      console.log('❌ Failed to generate PIX:', pixResponse.status);
      console.log('   Error:', pixResponse.data.error);
      console.log('   This is the BUG - INATIVO users should be able to generate PIX!');
    }
  } catch (error) {
    console.error('❌ PIX generation error:', error.message);
  }

  // Step 3: Try to access credentials (should be blocked for INATIVO)
  console.log('\n3️⃣ Attempting to access credentials...');
  try {
    const credentialsResponse = await axios.get(`${BASE_URL}/api/credentials`, {
      headers: {
        'Cookie': cookies
      },
      validateStatus: () => true
    });

    if (credentialsResponse.status === 200) {
      console.log('⚠️  Unexpected: INATIVO user can access credentials');
      console.log('   Locked:', credentialsResponse.data.locked);
    } else if (credentialsResponse.status === 403) {
      console.log('✅ Correctly blocked from accessing credentials');
      console.log('   Error:', credentialsResponse.data.error);
    } else {
      console.log('❓ Unexpected response:', credentialsResponse.status);
      console.log('   Data:', credentialsResponse.data);
    }
  } catch (error) {
    console.error('❌ Credentials access error:', error.message);
  }

  console.log('\n✅ Test complete!');
  console.log('Expected behavior:');
  console.log('  - INATIVO user can login ✓');
  console.log('  - INATIVO user can generate PIX ✓');
  console.log('  - INATIVO user cannot access credentials ✓');
}

// Run the test
test().catch(console.error);