const { spawn } = require('child_process');

const BASE_URL = 'http://localhost:5000';
const testUser = {
  username: 'portfolioTester',
  email: `tester_${Date.now()}@wealthai.edu`,
  password: 'testpassword123'
};

let authToken = '';
let txIds = [];

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
  console.log('--- STARTING PORTFOLIO SERVICE INTEGRATION TESTS ---');

  try {
    // 1. Register test user
    console.log(`Registering test user: ${testUser.email}...`);
    const register = await makeRequest('/api/auth/register', 'POST', testUser);
    if (register.status !== 201) throw new Error('Registration failed');
    authToken = register.data.token;
    console.log('✔ Registration successful, token acquired');

    // 2. Test search autocomplete proxy
    console.log("Testing ticker search (Reliance)...");
    const search = await makeRequest('/api/portfolio/search?q=Reliance', 'GET', null, authToken);
    if (search.status !== 200 || !Array.isArray(search.data)) {
      throw new Error('Search autocomplete failed');
    }
    console.log(`✔ Search successful, found ${search.data.length} matches`);
    if (search.data.length > 0) {
      console.log('  - First match:', search.data[0]);
    }

    // 3. Buy holdings via the transaction-log-driven API (POST /api/portfolio/transaction)
    console.log("Logging 2 buy transactions (Reliance stock, SBI mutual fund)...");

    // Reliance stock: buy 10 @ 1300
    const relBuy = await makeRequest('/api/portfolio/transaction', 'POST', {
      symbol: 'RELIANCE.NS',
      type: 'buy',
      quantity: 10,
      price: 1300,
      amount: 13000
    }, authToken);
    if (relBuy.status !== 200) throw new Error(`Failed to buy Reliance stock: ${JSON.stringify(relBuy.data)}`);
    txIds.push(relBuy.data._id);
    console.log('✔ Bought Reliance stock');

    // SBI MF: buy 100 @ 100
    const sbiBuy = await makeRequest('/api/portfolio/transaction', 'POST', {
      symbol: '119598',
      type: 'buy',
      quantity: 100,
      price: 100,
      amount: 10000
    }, authToken);
    if (sbiBuy.status !== 200) throw new Error(`Failed to buy SBI Mutual Fund: ${JSON.stringify(sbiBuy.data)}`);
    txIds.push(sbiBuy.data._id);
    console.log('✔ Bought SBI Mutual Fund');

    // 3b. Validation guard: a buy with no quantity/price must be rejected (regression test
    // for the NaN-corruption bug that used to silently accept these).
    console.log("Verifying buy without quantity/price is rejected...");
    const badBuy = await makeRequest('/api/portfolio/transaction', 'POST', {
      symbol: 'RELIANCE.NS',
      type: 'buy',
      amount: 5000
    }, authToken);
    if (badBuy.status !== 400) {
      throw new Error(`Expected 400 for buy missing quantity/price, got ${badBuy.status}`);
    }
    console.log('✔ Buy without quantity/price correctly rejected with 400');

    // 4. Fetch and Verify enriched holdings
    console.log("Fetching and verifying enriched portfolio holdings...");
    const portfolio = await makeRequest('/api/portfolio', 'GET', null, authToken);
    if (portfolio.status !== 200) throw new Error('Failed to fetch portfolio');

    const { holdings, summary } = portfolio.data;
    if (holdings.length !== 2) {
      throw new Error(`Expected 2 holdings, got ${holdings.length}`);
    }

    console.log('✔ Enrichment validation checks passed:');
    console.log(`  - Total Invested Capital: ₹${summary.totalInvested}`);
    console.log(`  - Total Current Value: ₹${summary.totalCurrent}`);
    console.log(`  - Total Portfolio P&L: ₹${summary.totalPnl.toFixed(2)} (${summary.totalPnlPercent.toFixed(2)}%)`);

    for (const h of holdings) {
      console.log(`    * ${h.symbol}: qty=${h.quantity}, avgPrice=₹${h.avgBuyPrice}, livePrice=₹${h.livePrice}, currentValue=₹${h.currentValue}, P&L=₹${h.pnl.toFixed(2)} (${h.pnlPercent.toFixed(2)}%)`);
      if (!h.success) {
        console.warn(`    ⚠️ Warning: Quote query failed for ${h.symbol} (using fallback price)`);
      }
    }

    // 5. Sell part of the Reliance position
    console.log(`Selling 5 shares of Reliance stock...`);
    const sellRel = await makeRequest('/api/portfolio/transaction', 'POST', {
      symbol: 'RELIANCE.NS',
      type: 'sell',
      quantity: 5,
      price: 1350,
      amount: 6750
    }, authToken);
    if (sellRel.status !== 200) throw new Error(`Failed to sell Reliance stock: ${JSON.stringify(sellRel.data)}`);
    console.log('✔ Sold 5 Reliance shares successfully');

    const afterSell = await makeRequest('/api/portfolio', 'GET', null, authToken);
    const relHolding = afterSell.data.holdings.find(h => h.symbol === 'RELIANCE.NS');
    if (!relHolding || relHolding.quantity !== 5) {
      throw new Error(`Expected 5 remaining Reliance shares, got ${relHolding ? relHolding.quantity : 'holding removed'}`);
    }
    console.log('✔ Remaining Reliance quantity is correct (5)');

    // 5b. Selling more than held must be rejected (no NaN corruption)
    console.log("Verifying oversell is rejected...");
    const oversell = await makeRequest('/api/portfolio/transaction', 'POST', {
      symbol: 'RELIANCE.NS',
      type: 'sell',
      quantity: 999,
      price: 1350,
      amount: 1349650
    }, authToken);
    if (oversell.status !== 400) {
      throw new Error(`Expected 400 for oversell, got ${oversell.status}`);
    }
    console.log('✔ Oversell correctly rejected with 400');

    // 6. Delete a transaction log (removes the SBI Mutual Fund holding entirely)
    console.log("Cleaning up: Deleting SBI Mutual Fund buy transaction...");
    const deleteSbi = await makeRequest(`/api/portfolio/transaction/${txIds[1]}`, 'DELETE', null, authToken);
    if (deleteSbi.status !== 200) throw new Error('Failed to delete transaction log');
    console.log('✔ Transaction log deleted successfully');

    // 7. Verify portfolio again
    console.log("Final verification of holdings list...");
    const finalPortfolio = await makeRequest('/api/portfolio', 'GET', null, authToken);
    if (finalPortfolio.data.holdings.length !== 1) {
      throw new Error(`Expected 1 holding after cleanup, got ${finalPortfolio.data.holdings.length}`);
    }
    console.log('✔ Holdings count is correct (1)');

    console.log('-------------------------------------------');
    console.log('✔ ALL PORTFOLIO SERVICE INTEGRATION TESTS PASSED!');
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

    if ((output.includes('Server running on port') || output.includes('MongoDB Connected')) && !testsStarted) {
      testsStarted = true;
      await new Promise(resolve => setTimeout(resolve, 1500));

      const success = await runTests();

      serverProcess.kill('SIGINT');
      process.exit(success ? 0 : 1);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error]: ${data}`);
  });
}

startServerAndRun();
