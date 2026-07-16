const { spawn } = require('child_process');

const BASE_URL = 'http://localhost:5050';
const testUser = {
  username: 'projectionTester',
  email: `proj_tester_${Date.now()}@wealthai.edu`,
  password: 'testpassword123'
};

let authToken = '';

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
  console.log('--- STARTING MONTE CARLO PROJECTIONS INTEGRATION TESTS ---');

  try {
    // 1. Register test user
    console.log(`Registering test user: ${testUser.email}...`);
    const register = await makeRequest('/api/auth/register', 'POST', testUser);
    if (register.status !== 200 && register.status !== 201) {
      throw new Error(`Registration failed with status ${register.status}`);
    }
    authToken = register.data.token;
    console.log('✔ Registration successful, token acquired');

    // 2. Query /api/analytics/projection with mock parameters
    console.log('Querying projections with current_net_worth=100000, monthly_savings=5000, years=10, risk_profile=balanced...');
    const result = await makeRequest('/api/analytics/projection', 'POST', {
      current_net_worth: 100000,
      monthly_savings: 5000,
      years: 10,
      risk_profile: 'balanced'
    }, authToken);

    if (result.status !== 200) {
      throw new Error(`Projections query failed with status ${result.status}: ${JSON.stringify(result.data)}`);
    }

    const { defaults, simulation } = result.data;
    
    // Assert defaults
    if (!defaults || defaults.current_net_worth !== 100000 || defaults.monthly_savings !== 5000) {
      throw new Error(`Defaults mismatch: expected net worth 100000, savings 5000, got ${JSON.stringify(defaults)}`);
    }
    console.log('✔ Defaults verified successfully');

    // Assert simulation details
    if (!simulation || simulation.risk_profile !== 'balanced' || !Array.isArray(simulation.projections)) {
      throw new Error(`Simulation mismatch: expected balanced profile, got ${JSON.stringify(simulation)}`);
    }
    console.log(`✔ Simulation profile verified (risk_profile: ${simulation.risk_profile}, mean: ${simulation.mean}, std_dev: ${simulation.std_dev})`);

    // Assert projections structure
    const projections = simulation.projections;
    if (projections.length !== 11) {
      throw new Error(`Expected 11 year-by-year points (0 to 10), got ${projections.length}`);
    }
    
    projections.forEach((p, idx) => {
      if (p.year !== idx) {
        throw new Error(`Expected year ${idx}, got ${p.year}`);
      }
      if (p.p10 === undefined || p.p50 === undefined || p.p90 === undefined) {
        throw new Error(`Missing percentile bounds at year ${idx}`);
      }
      if (p.p10 > p.p50 || p.p50 > p.p90) {
        throw new Error(`Invalid percentile values at year ${idx}: p10=${p.p10}, p50=${p.p50}, p90=${p.p90}`);
      }
    });
    console.log('✔ Year-by-year percentile properties verified (0 to 10)');

    // 3. Volatility spread verification: Compare Conservative vs Aggressive
    console.log('Verifying volatility spread between Conservative and Aggressive risk strategies...');
    
    const consResult = await makeRequest('/api/analytics/projection', 'POST', {
      current_net_worth: 100000,
      monthly_savings: 5000,
      years: 10,
      risk_profile: 'conservative'
    }, authToken);

    const aggResult = await makeRequest('/api/analytics/projection', 'POST', {
      current_net_worth: 100000,
      monthly_savings: 5000,
      years: 10,
      risk_profile: 'aggressive'
    }, authToken);

    if (consResult.status !== 200 || aggResult.status !== 200) {
      throw new Error('Failed to retrieve comparative strategy results');
    }

    const consYear10 = consResult.data.simulation.projections[10];
    const aggYear10 = aggResult.data.simulation.projections[10];

    const consSpread = consYear10.p90 - consYear10.p10;
    const aggSpread = aggYear10.p90 - aggYear10.p10;

    console.log(`  - Conservative Year 10 Spread (P90 - P10): ₹${consSpread.toLocaleString()}`);
    console.log(`  - Aggressive Year 10 Spread (P90 - P10): ₹${aggSpread.toLocaleString()}`);

    if (aggSpread <= consSpread) {
      throw new Error(`Expected Aggressive spread to be wider than Conservative spread, but got Aggressive=${aggSpread} <= Conservative=${consSpread}`);
    }
    console.log('✔ Asserted that Aggressive risk strategy generates significantly higher variance/volatility than Conservative');

    console.log('----------------------------------------------------');
    console.log('✔ ALL MONTE CARLO PROJECTIONS INTEGRATION TESTS PASSED!');
    console.log('----------------------------------------------------');
    return true;
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    return false;
  }
}

let testsStarted = false;
function startServerAndRun() {
  const serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: '5050' }
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
