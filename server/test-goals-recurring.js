const BASE_URL = 'http://localhost:5000';
const testUser = {
  username: 'wealthy_user',
  email: `wealth_${Date.now()}@advisor.com`,
  password: 'luxury_password_123',
  monthlyIncome: 80000
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
  console.log('--- STARTING GOALS & RECURRING BILLS BACKEND TESTS ---');

  try {
    // 1. Health check
    const health = await makeRequest('/health');
    if (health.status !== 200) throw new Error('Health check failed');
    console.log('✔ Health check OK');

    // 2. Register
    console.log('Registering user...');
    const register = await makeRequest('/api/auth/register', 'POST', testUser);
    if (register.status !== 201 || !register.data.token) {
      throw new Error(`Register failed: ${JSON.stringify(register.data)}`);
    }
    authToken = register.data.token;
    console.log('✔ Registration OK');

    // 3. Add monthly income user profile detail
    console.log('Updating user monthly income...');
    const profileUpdate = await makeRequest('/api/auth/profile', 'PUT', { monthlyIncome: 80000 }, authToken);
    if (profileUpdate.status !== 200) {
      throw new Error(`Failed to update monthly income: ${JSON.stringify(profileUpdate.data)}`);
    }
    console.log('✔ Monthly income updated OK');

    // 4. Create mock transactions to trigger recurring bills
    console.log('Creating transactions to trigger Netflix (monthly) & Spotify (monthly) recurring detection...');
    
    // Netflix payments: month 1, month 2, month 3
    const today = new Date();
    const date1 = new Date(); date1.setMonth(today.getMonth() - 2);
    const date2 = new Date(); date2.setMonth(today.getMonth() - 1);
    const date3 = new Date(); // today
    
    // Let's create transactions
    await makeRequest('/api/transactions', 'POST', {
      amount: 499,
      type: 'expense',
      category: 'Entertainment',
      description: 'Netflix subscription',
      date: date1
    }, authToken);

    await makeRequest('/api/transactions', 'POST', {
      amount: 499,
      type: 'expense',
      category: 'Entertainment',
      description: 'Netflix subscription',
      date: date2
    }, authToken);

    await makeRequest('/api/transactions', 'POST', {
      amount: 499,
      type: 'expense',
      category: 'Entertainment',
      description: 'Netflix subscription',
      date: date3
    }, authToken);

    // Spotify - just one transaction, but has known keyword
    await makeRequest('/api/transactions', 'POST', {
      amount: 119,
      type: 'expense',
      category: 'Entertainment',
      description: 'Spotify Premium',
      date: date2
    }, authToken);

    // Groceries (non-recurring)
    await makeRequest('/api/transactions', 'POST', {
      amount: 1500,
      type: 'expense',
      category: 'Food',
      description: 'Organic groceries',
      date: date3
    }, authToken);

    // Add some income so they have savings rate
    await makeRequest('/api/transactions', 'POST', {
      amount: 80000,
      type: 'income',
      category: 'Salary',
      description: 'Salary stipend',
      date: date1
    }, authToken);

    await makeRequest('/api/transactions', 'POST', {
      amount: 80000,
      type: 'income',
      category: 'Salary',
      description: 'Salary stipend',
      date: date2
    }, authToken);

    await makeRequest('/api/transactions', 'POST', {
      amount: 80000,
      type: 'income',
      category: 'Salary',
      description: 'Salary stipend',
      date: date3
    }, authToken);

    // 5. Test GET /api/analytics/recurring
    console.log('Testing GET /api/analytics/recurring...');
    const recurringRes = await makeRequest('/api/analytics/recurring', 'GET', null, authToken);
    if (recurringRes.status !== 200) {
      throw new Error(`Failed to get recurring: ${recurringRes.status}`);
    }
    const recData = recurringRes.data;
    console.log('Detected recurring items:', recData);
    if (recData.length < 2) {
      throw new Error('Should have detected Netflix and Spotify as recurring');
    }
    console.log('✔ Recurring detector working successfully');

    // 6. Test Savings Goals CRUD
    console.log('Creating a savings goal "New Car" for ₹5,00,000 due in 10 months...');
    const deadline = new Date();
    deadline.setMonth(today.getMonth() + 10);
    const goalRes = await makeRequest('/api/goals', 'POST', {
      name: 'New Car',
      targetAmount: 500000,
      currentAmount: 50000,
      deadline: deadline.toISOString(),
      color: '#d97706'
    }, authToken);

    if (goalRes.status !== 201) {
      throw new Error(`Failed to create goal: ${goalRes.status} ${JSON.stringify(goalRes.data)}`);
    }
    const goalId = goalRes.data._id;
    console.log('✔ Goal creation OK');

    // 7. Get Goals projection analysis
    console.log('Fetching analyzed goals...');
    const listRes = await makeRequest('/api/goals', 'GET', null, authToken);
    if (listRes.status !== 200) {
      throw new Error(`Failed to list goals: ${listRes.status}`);
    }
    console.log('Goals List with Projections:', listRes.data);
    const carGoal = listRes.data.goals.find(g => g._id === goalId);
    if (!carGoal) throw new Error('Goal not found in list');
    if (carGoal.monthlySavingsRequired === undefined || carGoal.averageMonthlySavings === undefined) {
      throw new Error('Goal projections are missing required analytical fields');
    }
    console.log('✔ Goal projection logic OK');

    // 8. Update goal (Add contribution)
    console.log('Adding ₹20,000 contribution to goal...');
    const updateRes = await makeRequest(`/api/goals/${goalId}`, 'PUT', { contribution: 20000 }, authToken);
    if (updateRes.status !== 200) {
      throw new Error(`Failed to update goal: ${updateRes.status}`);
    }
    console.log('Updated Goal:', updateRes.data);
    if (updateRes.data.currentAmount !== 70000) {
      throw new Error('Contribution was not added correctly');
    }
    console.log('✔ Goal contribution updates OK');

    // 9. Delete goal
    console.log('Deleting goal...');
    const deleteRes = await makeRequest(`/api/goals/${goalId}`, 'DELETE', null, authToken);
    if (deleteRes.status !== 200) {
      throw new Error(`Failed to delete goal: ${deleteRes.status}`);
    }
    console.log('✔ Goal deletion OK');

    console.log('--- ALL BACKEND GOALS & RECURRING TESTS PASSED SUCCESSFULLY! ---');
  } catch (err) {
    console.error('❌ Test failed with error:', err.message);
    process.exit(1);
  }
}

runTests();
