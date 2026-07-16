const BASE_URL = 'http://localhost:5000';
const testUser = {
  username: 'sms_user',
  email: `sms_sync_${Date.now()}@capstone.com`,
  password: 'sync_password_999'
};

let authToken = '';

async function makeRequest(endpoint, method = 'GET', body = null, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('--- STARTING BANK SMS PARSER INTEGRATION TESTS ---');

  try {
    // 1. Register User
    console.log('Registering test user...');
    const register = await makeRequest('/api/auth/register', 'POST', testUser);
    if (register.status !== 201 || !register.data.token) {
      throw new Error(`Register failed: ${JSON.stringify(register.data)}`);
    }
    authToken = register.data.token;
    console.log('✔ Registration OK');

    // 2. Parse Netflix debit SMS
    console.log('Testing Netflix charge SMS...');
    const sms1 = "Alert: Your credit card was charged INR 499.00 at Netflix on 19-Jun-2026.";
    const res1 = await makeRequest('/api/transactions/parse-sms', 'POST', { smsText: sms1 }, authToken);
    if (res1.status !== 201) {
      throw new Error(`Netflix SMS failed: ${res1.status} - ${JSON.stringify(res1.data)}`);
    }
    console.log('✔ Netflix parsed:', res1.data);
    if (res1.data.amount !== 499 || res1.data.type !== 'expense' || !res1.data.description.includes('Netflix')) {
      throw new Error('Netflix SMS parsed incorrectly');
    }

    // 3. Parse Reliance Fresh spend SMS
    console.log('Testing Reliance Fresh Rs. spend SMS...');
    const sms2 = "Rs. 2,500.00 spent at Reliance Fresh using UPI.";
    const res2 = await makeRequest('/api/transactions/parse-sms', 'POST', { smsText: sms2 }, authToken);
    if (res2.status !== 201) {
      throw new Error(`Reliance Fresh SMS failed: ${res2.status}`);
    }
    console.log('✔ Reliance Fresh parsed:', res2.data);
    if (res2.data.amount !== 2500 || res2.data.type !== 'expense' || !res2.data.description.includes('Reliance Fresh')) {
      throw new Error('Reliance Fresh SMS parsed incorrectly');
    }

    // 4. Parse Salary credited SMS
    console.log('Testing Salary credited SMS...');
    const sms3 = "Salary of INR 75,000.00 credited to account XX4958 on 01-Jun-2026.";
    const res3 = await makeRequest('/api/transactions/parse-sms', 'POST', { smsText: sms3 }, authToken);
    if (res3.status !== 201) {
      throw new Error(`Salary SMS failed: ${res3.status}`);
    }
    console.log('✔ Salary parsed:', res3.data);
    if (res3.data.amount !== 75000 || res3.data.type !== 'income' || !res3.data.description.includes('Salary')) {
      throw new Error('Salary SMS parsed incorrectly');
    }

    console.log('--- ALL SMS PARSER BACKEND TESTS PASSED SUCCESSFULLY! ---');
  } catch (err) {
    console.error('❌ SMS Parser test failed:', err.message);
    process.exit(1);
  }
}

runTests();
