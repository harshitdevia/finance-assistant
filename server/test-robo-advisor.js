const BASE_URL = 'http://localhost:5000';
const testUser = {
  username: 'RoboTester',
  email: `advisor_tester_${Date.now()}@wealthai.edu`,
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
  console.log('--- STARTING ROBO-ADVISOR PORTFOLIO SERVICE VERIFICATION ---');

  try {
    // 1. Register test user
    console.log(`Registering tester: ${testUser.email}...`);
    const reg = await makeRequest('/api/auth/register', 'POST', testUser);
    if (reg.status !== 201) throw new Error('Registration failed');
    authToken = reg.data.token;
    console.log('✔ Registration successful');

    // 2. Log BUY transaction (TCS.NS - 10 shares @ ₹3000)
    console.log('\nLogging BUY transaction 1: 10 shares of TCS.NS @ ₹3000...');
    const tx1 = await makeRequest('/api/portfolio/transaction', 'POST', {
      symbol: 'TCS.NS',
      type: 'buy',
      quantity: 10,
      price: 3000,
      amount: 30000,
      date: new Date(),
      notes: 'Initial buy'
    }, authToken);
    if (tx1.status !== 200) throw new Error('Failed to log transaction 1');
    console.log('✔ BUY transaction 1 logged successfully');

    // 3. Log BUY transaction 2 (TCS.NS - 5 shares @ ₹3300)
    console.log('Logging BUY transaction 2: 5 shares of TCS.NS @ ₹3300...');
    const tx2 = await makeRequest('/api/portfolio/transaction', 'POST', {
      symbol: 'TCS.NS',
      type: 'buy',
      quantity: 5,
      price: 3300,
      amount: 16500,
      date: new Date(),
      notes: 'Dip buying'
    }, authToken);
    if (tx2.status !== 200) throw new Error('Failed to log transaction 2');
    console.log('✔ BUY transaction 2 logged successfully');

    // 4. Fetch portfolio and verify weighted average cost recalculation
    console.log('\nVerifying holding values for TCS.NS...');
    const p1 = await makeRequest('/api/portfolio', 'GET', null, authToken);
    if (p1.status !== 200) throw new Error('Failed to fetch portfolio');
    const tcsHolding = p1.data.holdings.find(h => h.symbol === 'TCS.NS');
    if (!tcsHolding) throw new Error('Holding not created for TCS.NS');
    
    console.log(`  - Total quantity: ${tcsHolding.quantity} (Expected: 15)`);
    console.log(`  - Weighted Avg Purchase Price: ₹${tcsHolding.avgBuyPrice} (Expected: 3100)`);
    if (tcsHolding.quantity !== 15 || tcsHolding.avgBuyPrice !== 3100) {
      throw new Error('Weighted average calculation mismatch');
    }
    console.log('✔ Weighted cost basis recalculated correctly');

    // 5. Log DIVIDEND payout (TCS.NS - ₹600 payout)
    console.log('\nLogging DIVIDEND transaction of ₹600 for TCS.NS...');
    const tx3 = await makeRequest('/api/portfolio/transaction', 'POST', {
      symbol: 'TCS.NS',
      type: 'dividend',
      amount: 600,
      date: new Date(),
      notes: 'Q1 dividend'
    }, authToken);
    if (tx3.status !== 200) throw new Error('Failed to log dividend payout');
    console.log('✔ Dividend payout logged');

    // 6. Log historical BUY transaction (RELIANCE.NS - 10 shares @ ₹1200, 2 years ago to check LTCG)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    console.log(`\nLogging historical BUY transaction: 10 shares of RELIANCE.NS @ ₹1200 on ${twoYearsAgo.toLocaleDateString()}...`);
    const tx4 = await makeRequest('/api/portfolio/transaction', 'POST', {
      symbol: 'RELIANCE.NS',
      type: 'buy',
      quantity: 10,
      price: 1200,
      amount: 12000,
      date: twoYearsAgo,
      notes: 'Long-term holding'
    }, authToken);
    if (tx4.status !== 200) throw new Error('Failed to log historical buy');
    console.log('✔ Historical transaction logged');

    // 7. Verify portfolio tax categorization (LTCG vs STCG)
    console.log('\nFetching portfolio tax and gains breakdown...');
    const p2 = await makeRequest('/api/portfolio', 'GET', null, authToken);
    if (p2.status !== 200) throw new Error('Failed to fetch portfolio');
    
    const relHolding = p2.data.holdings.find(h => h.symbol === 'RELIANCE.NS');
    const finalTcsHolding = p2.data.holdings.find(h => h.symbol === 'TCS.NS');

    console.log(`  - Total Dividends: ₹${p2.data.summary.totalDividends} (Expected: 600)`);
    console.log(`  - RELIANCE.NS holding type: LTCG Shares Qty = ${relHolding.ltcgQty}, STCG Shares Qty = ${relHolding.stcgQty}`);
    console.log(`  - TCS.NS holding type: LTCG Shares Qty = ${finalTcsHolding.ltcgQty}, STCG Shares Qty = ${finalTcsHolding.stcgQty}`);
    
    if (relHolding.ltcgQty !== 10 || finalTcsHolding.stcgQty !== 15 || p2.data.summary.totalDividends !== 600) {
      throw new Error('LTCG/STCG or Dividend calculation verification failed');
    }
    console.log('✔ FIFO Tax Lot categorization logic verified');

    // 8. Query AI Advisor Analysis (balanced riskProfile)
    console.log('\nCalling Robo-Advisor AI analysis...');
    const analysis = await makeRequest('/api/portfolio/analyze', 'POST', {
      riskProfile: 'balanced',
      holdings: p2.data.holdings
    }, authToken);
    if (analysis.status === 200 && analysis.data.riskScore !== undefined) {
      console.log('✔ Robo-Advisor analysis returned successfully:');
      console.log(`  - Risk score: ${analysis.data.riskScore}/100`);
      console.log(`  - Allocation: Equity=${analysis.data.actualAllocation.equity}%, Debt=${analysis.data.actualAllocation.debt}%, Gold=${analysis.data.actualAllocation.gold}%`);
      console.log('  - Recommendations:');
      analysis.data.recommendations.forEach(r => console.log(`    * ${r}`));
    } else {
      throw new Error('Failed to query robo-advisor suggestions');
    }

    console.log('\n-------------------------------------------');
    console.log('✔ ALL PORTFOLIO EXTENSION INTEGRATION TESTS PASSED!');
    console.log('-------------------------------------------');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Integration verification failed:', err.message);
    process.exit(1);
  }
}

runTests();
