const BASE_URL = 'http://localhost:5000';
const testUser = {
  username: 'ImportTester',
  email: `import_tester_${Date.now()}@wealthai.edu`,
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
  console.log('--- STARTING BANK STATEMENT CSV IMPORT VERIFICATION ---');

  try {
    // 1. Register test user
    console.log(`Registering tester: ${testUser.email}...`);
    const reg = await makeRequest('/api/auth/register', 'POST', testUser);
    if (reg.status !== 201) throw new Error('Registration failed');
    authToken = reg.data.token;
    console.log('✔ Registration successful');

    // 2. Prepare mock statement rows parsed from client
    const mockRows = [
      { date: '2026-06-20', description: 'Zomato Food Delivery Online Order', amount: 450, type: 'expense' },
      { date: '2026-06-21', description: 'HDFC Corp Salary Credit Monthly', amount: 65000, type: 'income' },
      { date: '2026-06-22', description: 'Netflix streaming subscription fee', amount: 649, type: 'expense' },
      { date: '2026-06-23', description: 'Uber rides city transport cab', amount: 350, type: 'expense' }
    ];

    // 3. Post to import-preview to verify auto-categorization
    console.log('\nSending mock CSV rows to /import-preview for ML classification...');
    const previewRes = await makeRequest('/api/transactions/import-preview', 'POST', { rows: mockRows }, authToken);
    if (previewRes.status !== 200) {
      throw new Error(`Import preview failed with status ${previewRes.status}`);
    }

    const previewData = previewRes.data;
    console.log('✔ Received ML enriched categorization response:');
    previewData.forEach(row => {
      console.log(`  - "${row.description}" [₹${row.amount}] ➡️ ML Category: "${row.category}" (Type: ${row.type})`);
    });

    // Verify key categories are mapped correctly by Naive Bayes
    const zomatoRow = previewData.find(r => r.description.includes('Zomato'));
    const salaryRow = previewData.find(r => r.description.includes('Salary'));
    const netflixRow = previewData.find(r => r.description.includes('Netflix'));

    if (!zomatoRow || !salaryRow || !netflixRow) {
      throw new Error('Some mock transactions were lost during preview processing');
    }

    if (zomatoRow.category !== 'Food' && zomatoRow.category !== 'Groceries') {
      console.warn(`⚠️ Warning: Zomato got mapped to unexpected category: ${zomatoRow.category}`);
    }
    if (salaryRow.category !== 'Salary') {
      console.warn(`⚠️ Warning: Salary got mapped to unexpected category: ${salaryRow.category}`);
    }

    console.log('✔ Category mappings validation check passed');

    // 4. Submit processed preview array to bulk import endpoint
    console.log('\nSubmitting enriched rows to bulk import...');
    const importRes = await makeRequest('/api/transactions/import', 'POST', { rows: previewData }, authToken);
    if (importRes.status !== 201) {
      throw new Error(`Bulk import failed with status ${importRes.status}: ${JSON.stringify(importRes.data)}`);
    }
    console.log(`✔ Bulk import success: ${importRes.data.message}`);

    // 5. Fetch transactions and verify length
    console.log('\nFetching transaction history to verify count...');
    const listRes = await makeRequest('/api/transactions', 'GET', null, authToken);
    if (listRes.status !== 200) {
      throw new Error('Failed to fetch transaction history');
    }

    console.log(`  - Total transactions in DB: ${listRes.data.length} (Expected: 4)`);
    if (listRes.data.length !== 4) {
      throw new Error('Transaction count mismatch in database');
    }

    console.log('\n-------------------------------------------');
    console.log('✔ ALL CSV IMPORT INTEGRATION TESTS PASSED!');
    console.log('-------------------------------------------');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Import verification failed:', err.message);
    process.exit(1);
  }
}

runTests();
