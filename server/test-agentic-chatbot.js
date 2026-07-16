const BASE_URL = 'http://localhost:5000';
const testUser = {
  username: 'AgentTester',
  email: `agent_tester_${Date.now()}@wealthai.edu`,
  password: 'testpassword123'
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
  console.log('--- STARTING AGENTIC FINANCIAL CHATBOT VERIFICATION ---');

  try {
    // 1. Register test user
    console.log(`Registering tester: ${testUser.email}...`);
    const reg = await makeRequest('/api/auth/register', 'POST', testUser);
    if (reg.status !== 201) throw new Error('Registration failed');
    authToken = reg.data.token;
    console.log('✔ Registration successful');

    // 2. Test Transaction Log Trigger via Chat
    const chatMsg1 = "log expense of 450 for Food with description Swiggy Burger";
    console.log(`\nSending message to Chatbot: "${chatMsg1}"...`);
    
    const res1 = await makeRequest('/api/chatbot', 'POST', { message: chatMsg1 }, authToken);
    if (res1.status !== 200) throw new Error('Chatbot request 1 failed');
    
    console.log('✔ Response received:');
    console.log(`  - Text Reply:\n${res1.data.reply}`);
    console.log('  - Action Metadata:', JSON.stringify(res1.data.actionTriggered));

    if (!res1.data.actionTriggered || res1.data.actionTriggered.type !== 'CREATE_TRANSACTION') {
      throw new Error('Chatbot did not register transaction write intent');
    }

    // Verify transaction exists in database
    const txList = await makeRequest('/api/transactions', 'GET', null, authToken);
    if (txList.status !== 200 || txList.data.length !== 1) {
      throw new Error('Transaction was not written to MongoDB');
    }
    console.log('✔ Verified transaction successfully inserted into MongoDB');

    // 3. Test Savings Goal Setup via Chat
    const chatMsg2 = "create goal Macbook with target 150000 date 2027-06-30";
    console.log(`\nSending message to Chatbot: "${chatMsg2}"...`);
    
    const res2 = await makeRequest('/api/chatbot', 'POST', { message: chatMsg2 }, authToken);
    if (res2.status !== 200) throw new Error('Chatbot request 2 failed');
    
    console.log('✔ Response received:');
    console.log(`  - Text Reply:\n${res2.data.reply}`);
    console.log('  - Action Metadata:', JSON.stringify(res2.data.actionTriggered));

    if (!res2.data.actionTriggered || res2.data.actionTriggered.type !== 'CREATE_GOAL') {
      throw new Error('Chatbot did not register savings goal write intent');
    }

    // Verify goal exists in database
    const goalList = await makeRequest('/api/goals', 'GET', null, authToken);
    if (goalList.status !== 200 || !goalList.data.goals || goalList.data.goals.length !== 1) {
      throw new Error('Goal was not written to MongoDB');
    }
    console.log('✔ Verified savings goal successfully inserted into MongoDB');

    // 4. Test Budget Limit Change via Chat
    const chatMsg3 = "set budget for Entertainment to 4000";
    console.log(`\nSending message to Chatbot: "${chatMsg3}"...`);
    
    const res3 = await makeRequest('/api/chatbot', 'POST', { message: chatMsg3 }, authToken);
    if (res3.status !== 200) throw new Error('Chatbot request 3 failed');
    
    console.log('✔ Response received:');
    console.log(`  - Text Reply:\n${res3.data.reply}`);
    console.log('  - Action Metadata:', JSON.stringify(res3.data.actionTriggered));

    if (!res3.data.actionTriggered || res3.data.actionTriggered.type !== 'CREATE_BUDGET') {
      throw new Error('Chatbot did not register budget write intent');
    }

    // Verify budget exists in database
    const budgetList = await makeRequest('/api/budgets', 'GET', null, authToken);
    if (budgetList.status !== 200 || budgetList.data.length !== 1) {
      throw new Error('Budget was not written to MongoDB');
    }
    console.log('✔ Verified monthly budget successfully inserted into MongoDB');

    console.log('\n-------------------------------------------');
    console.log('✔ ALL AGENTIC CHATBOT INTEGRATION TESTS PASSED!');
    console.log('-------------------------------------------');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Agentic Chatbot verification failed:', err.message);
    process.exit(1);
  }
}

runTests();
