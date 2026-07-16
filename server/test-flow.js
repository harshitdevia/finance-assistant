const { spawn } = require('child_process');

const BASE_URL = 'http://localhost:5000';
const testUser = {
  username: 'teststudent',
  email: `student_${Date.now()}@capstone.edu`,
  password: 'securedpassword123'
};

let authToken = '';
let transactionId = '';

// Helper for HTTP requests using native fetch (Node.js 18+)
async function makeRequest(endpoint, method = 'GET', body = null, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('--- STARTING BACKEND INTEGRATION TESTS ---');

  try {
    // 1. Health Check
    console.log('Testing /health endpoint...');
    const health = await makeRequest('/health');
    if (health.status !== 200) throw new Error('Health check failed');
    console.log('✔ Health check OK');

    // 2. Register
    console.log(`Registering test user: ${testUser.email}...`);
    const register = await makeRequest('/api/auth/register', 'POST', testUser);
    if (register.status !== 201 || !register.data.token) {
      throw new Error(`Register failed: ${JSON.stringify(register.data)}`);
    }
    console.log('✔ Registration successful');

    // 3. Login
    console.log('Logging in...');
    const login = await makeRequest('/api/auth/login', 'POST', {
      email: testUser.email,
      password: testUser.password
    });
    if (login.status !== 200 || !login.data.token) {
      throw new Error('Login failed');
    }
    authToken = login.data.token;
    console.log('✔ Login successful, JWT token acquired');

    // 4. Get User Profile
    console.log('Verifying /me endpoint...');
    const me = await makeRequest('/api/auth/me', 'GET', null, authToken);
    if (me.status !== 200 || me.data.email !== testUser.email) {
      throw new Error('Get profile verification failed');
    }
    console.log(`✔ Profile verified: ${me.data.username} (${me.data.email})`);

    // 5. Create Transactions
    console.log('Creating transactions (1 income, 2 expenses)...');
    
    // Income
    const incTx = await makeRequest('/api/transactions', 'POST', {
      amount: 50000,
      type: 'income',
      category: 'Salary',
      description: 'Capstone project stipend',
      date: new Date()
    }, authToken);
    if (incTx.status !== 201) throw new Error('Failed to create income transaction');
    
    // Rent Expense
    const rentTx = await makeRequest('/api/transactions', 'POST', {
      amount: 15000,
      type: 'expense',
      category: 'Rent',
      description: 'Room rental',
      date: new Date()
    }, authToken);
    if (rentTx.status !== 201) throw new Error('Failed to create rent transaction');

    // Food Expense
    const foodTx = await makeRequest('/api/transactions', 'POST', {
      amount: 3000,
      type: 'expense',
      category: 'Food',
      description: 'Weekly grocery',
      date: new Date()
    }, authToken);
    if (foodTx.status !== 201) throw new Error('Failed to create food transaction');
    transactionId = foodTx.data._id; // Store for update/delete

    console.log('✔ All 3 test transactions created');

    // 6. Verify Transaction List
    console.log('Fetching all transactions...');
    const list = await makeRequest('/api/transactions', 'GET', null, authToken);
    if (list.status !== 200 || list.data.length !== 3) {
      throw new Error(`Expected 3 transactions, got ${list.data.length}`);
    }
    console.log('✔ List retrieved and count is correct (3)');

    // 7. Verify Filtered Transaction List
    console.log('Fetching filtered transactions (type=expense)...');
    const filteredList = await makeRequest('/api/transactions?type=expense', 'GET', null, authToken);
    if (filteredList.status !== 200 || filteredList.data.length !== 2) {
      throw new Error(`Expected 2 expense transactions, got ${filteredList.data.length}`);
    }
    console.log('✔ Filtering by type=expense works');

    // 8. Verify Analytics Summary
    console.log('Fetching analytics summary...');
    let summary = await makeRequest('/api/analytics/summary', 'GET', null, authToken);
    if (summary.status !== 200) throw new Error('Failed to fetch summary');
    
    const { totalIncome, totalExpense, netSavings, savingsRate, categoryBreakdown } = summary.data;
    if (totalIncome !== 50000 || totalExpense !== 18000 || netSavings !== 32000 || savingsRate !== 64.00) {
      throw new Error(`Summary analytics calculation error: ${JSON.stringify(summary.data)}`);
    }
    
    const rentBreakdown = categoryBreakdown.find(c => c.category === 'Rent');
    if (!rentBreakdown || rentBreakdown.amount !== 15000) {
      throw new Error('Category breakdown is incorrect');
    }
    console.log('✔ Analytics summary math is correct:');
    console.log(`  - Total Income: ₹${totalIncome}`);
    console.log(`  - Total Expense: ₹${totalExpense}`);
    console.log(`  - Net Savings: ₹${netSavings} (Savings Rate: ${savingsRate}%)`);

    // 8b. Verify Analytics Prediction (Linear Regression forecasting)
    console.log('Testing /api/analytics/prediction endpoint...');
    const predRes = await makeRequest('/api/analytics/prediction', 'GET', null, authToken);
    if (predRes.status !== 200) {
      throw new Error(`Prediction fetch failed with status ${predRes.status}`);
    }
    console.log('✔ Analytics prediction route OK:');
    console.log('  - Predicted Spends:', JSON.stringify(predRes.data));

    // 9. Update Transaction
    console.log(`Updating transaction ${transactionId} (Food amount 3000 -> 4500)...`);
    const updateTx = await makeRequest(`/api/transactions/${transactionId}`, 'PUT', {
      amount: 4500,
      description: 'Weekly grocery + organic snacks'
    }, authToken);
    if (updateTx.status !== 200 || updateTx.data.amount !== 4500) {
      throw new Error('Transaction update failed');
    }
    console.log('✔ Transaction updated successfully');

    // 10. Re-verify Summary Calculations after Update
    console.log('Re-verifying analytics summary after transaction update...');
    summary = await makeRequest('/api/analytics/summary', 'GET', null, authToken);
    if (summary.data.totalExpense !== 19500 || summary.data.netSavings !== 30500) {
      throw new Error(`Summary calculations failed after update: ${JSON.stringify(summary.data)}`);
    }
    console.log(`✔ Updated Analytics totals are correct: Expense ₹${summary.data.totalExpense}`);

    // 10b. Verify Chatbot Query (ML + Context Prompt)
    console.log('Testing /api/chatbot endpoint (Can I afford ₹5,000?)...');
    const chatRes = await makeRequest('/api/chatbot', 'POST', {
      message: 'Can I afford ₹5,000 right now?'
    }, authToken);
    if (chatRes.status !== 200 || !chatRes.data.reply) {
      throw new Error(`Chatbot query failed with status ${chatRes.status}`);
    }
    console.log('✔ Chatbot endpoint OK. Reply:');
    console.log(chatRes.data.reply);

    // 11. Delete Transaction
    console.log(`Deleting transaction ${transactionId}...`);
    const deleteTx = await makeRequest(`/api/transactions/${transactionId}`, 'DELETE', null, authToken);
    if (deleteTx.status !== 200) throw new Error('Transaction deletion failed');
    console.log('✔ Transaction deleted successfully');

    // 12. Final Verification of Summary totals
    console.log('Final summary totals verification...');
    summary = await makeRequest('/api/analytics/summary', 'GET', null, authToken);
    if (summary.data.totalExpense !== 15000 || summary.data.netSavings !== 35000) {
      throw new Error(`Summary calculations failed after deletion: ${JSON.stringify(summary.data)}`);
    }
    console.log('✔ Deletion verification summary OK');

    console.log('-------------------------------------------');
    console.log('✔ ALL BACKEND INTEGRATION TESTS PASSED!');
    console.log('-------------------------------------------');
    return true;
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    return false;
  }
}

// Spawns backend server and runs tests
let testsStarted = false;
function startServerAndRun() {
  const serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: '5000' }
  });

  serverProcess.stdout.on('data', async (data) => {
    const output = data.toString();
    console.log(`[Server]: ${output.trim()}`);
    
    // Once server is up, run tests
    if ((output.includes('Server running on port') || output.includes('MongoDB Connected')) && !testsStarted) {
      testsStarted = true;
      // Give MongoDB a brief moment to connect
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const success = await runTests();
      
      // Kill the server and exit tests
      serverProcess.kill('SIGINT');
      process.exit(success ? 0 : 1);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error]: ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

startServerAndRun();
