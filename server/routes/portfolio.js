const express = require('express');
const router = express.Router();
const Holding = require('../models/Holding');
const PortfolioTransaction = require('../models/PortfolioTransaction');
const auth = require('../middleware/auth');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

// @route    GET api/portfolio
// @desc     Get all user holdings, calculate FIFO Capital Gains (STCG/LTCG), and retrieve yield analytics
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const holdings = await Holding.find({ userId });

    if (holdings.length === 0) {
      return res.json({
        holdings: [],
        summary: {
          totalInvested: 0,
          totalCurrent: 0,
          totalPnl: 0,
          totalPnlPercent: 0,
          totalLtcgGain: 0,
          totalStcgGain: 0,
          totalEstimatedTax: 0,
          totalDividends: 0
        }
      });
    }

    // Filter unique symbols to fetch quotes for (exclude FDs)
    const liveSymbols = [
      ...new Set(
        holdings
          .filter(h => h.assetType !== 'fd')
          .map(h => h.symbol)
      )
    ];

    let quotes = {};
    if (liveSymbols.length > 0) {
      try {
        const mlRes = await fetch(`${ML_SERVICE_URL}/portfolio/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: liveSymbols })
        });
        if (mlRes.ok) {
          quotes = await mlRes.json();
        }
      } catch (err) {
        console.error('Error fetching live quotes from ML service:', err.message);
      }
    }

    let totalInvested = 0;
    let totalCurrent = 0;
    let totalLtcgGain = 0;
    let totalStcgGain = 0;
    let totalEstimatedTax = 0;
    let totalDividends = 0;

    const enrichedHoldings = await Promise.all(holdings.map(async (holding) => {
      const hObj = holding.toObject();
      let livePrice = hObj.avgBuyPrice;
      let change = 0;
      let changePercent = 0;
      let name = hObj.name;
      let success = false;

      if (hObj.assetType === 'fd') {
        success = true;
      } else {
        const quote = quotes[hObj.symbol];
        if (quote && quote.success) {
          livePrice = quote.price;
          change = quote.change;
          changePercent = quote.changePercent;
          name = quote.name || hObj.name;
          success = true;
        }
      }

      const investedValue = hObj.quantity * hObj.avgBuyPrice;
      const currentValue = hObj.quantity * livePrice;
      const pnl = currentValue - investedValue;
      const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

      // FIFO Simulation to determine holding period (LTCG / STCG)
      const txs = await PortfolioTransaction.find({ userId, symbol: hObj.symbol }).sort({ date: 1 });
      
      let buyLots = [];
      let dividendsReceived = 0;

      txs.forEach(tx => {
        if (tx.type === 'buy') {
          buyLots.push({
            qty: tx.quantity,
            price: tx.price,
            date: tx.date
          });
        } else if (tx.type === 'sell') {
          let sellQty = tx.quantity;
          while (sellQty > 0 && buyLots.length > 0) {
            if (buyLots[0].qty <= sellQty) {
              sellQty -= buyLots[0].qty;
              buyLots.shift(); // Remove fully sold lot
            } else {
              buyLots[0].qty -= sellQty;
              sellQty = 0;
            }
          }
        } else if (tx.type === 'dividend' || tx.type === 'interest') {
          dividendsReceived += tx.amount;
        }
      });

      // Fallback for legacy holdings added without transactional logging
      if (buyLots.length === 0 && hObj.quantity > 0) {
        buyLots.push({
          qty: hObj.quantity,
          price: hObj.avgBuyPrice,
          date: hObj.createdAt || new Date()
        });
      }

      // Calculate holding periods
      let stcgQty = 0;
      let ltcgQty = 0;
      let stcgGain = 0;
      let ltcgGain = 0;

      const equityDays = 365; // 1 year threshold for equities
      const otherDays = 1095; // 3 years threshold for gold and debt
      const thresholdDays = (hObj.assetType === 'stock' || hObj.assetType === 'mutual_fund') ? equityDays : otherDays;

      buyLots.forEach(lot => {
        const msDiff = Date.now() - new Date(lot.date).getTime();
        const daysDiff = msDiff / (1000 * 60 * 60 * 24);

        const gainPerShare = livePrice - lot.price;
        const totalLotGain = lot.qty * gainPerShare;

        if (daysDiff > thresholdDays) {
          ltcgQty += lot.qty;
          ltcgGain += totalLotGain;
        } else {
          stcgQty += lot.qty;
          stcgGain += totalLotGain;
        }
      });

      // Calculate tax simulation
      let estimatedTax = 0;
      if (hObj.assetType === 'stock' || hObj.assetType === 'mutual_fund') {
        if (ltcgGain > 0) estimatedTax += ltcgGain * 0.125; // 12.5% Equity LTCG
        if (stcgGain > 0) estimatedTax += stcgGain * 0.20;  // 20% Equity STCG
      } else {
        if (ltcgGain > 0) estimatedTax += ltcgGain * 0.20; // 20% Debt/Gold LTCG
        if (stcgGain > 0) estimatedTax += stcgGain * 0.30; // 30% slab rate approximation
      }
      
      estimatedTax = Math.max(0, estimatedTax);

      totalInvested += investedValue;
      totalCurrent += currentValue;
      totalLtcgGain += ltcgGain;
      totalStcgGain += stcgGain;
      totalEstimatedTax += estimatedTax;
      totalDividends += dividendsReceived;

      return {
        ...hObj,
        name,
        livePrice,
        change,
        changePercent,
        investedValue,
        currentValue,
        pnl,
        pnlPercent,
        success,
        ltcgQty,
        stcgQty,
        ltcgGain,
        stcgGain,
        estimatedTax,
        dividendsReceived
      };
    }));

    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    res.json({
      holdings: enrichedHoldings,
      summary: {
        totalInvested,
        totalCurrent,
        totalPnl,
        totalPnlPercent,
        totalLtcgGain,
        totalStcgGain,
        totalEstimatedTax,
        totalDividends
      }
    });

  } catch (err) {
    console.error('GET portfolio error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    POST api/portfolio/transaction
// @desc     Log a transaction and dynamically update the corresponding Holding
// @access   Private
router.post('/transaction', auth, async (req, res) => {
  const { symbol, type, quantity, price, amount, date, notes } = req.body;

  try {
    if (!symbol || !type || amount === undefined) {
      return res.status(400).json({ message: 'Please provide all required fields (symbol, type, amount)' });
    }

    if (type === 'buy' || type === 'sell') {
      const qtyNum = Number(quantity);
      const priceNum = Number(price);
      if (!quantity || !Number.isFinite(qtyNum) || qtyNum <= 0) {
        return res.status(400).json({ message: 'A positive quantity is required for buy/sell transactions' });
      }
      if (!price || !Number.isFinite(priceNum) || priceNum <= 0) {
        return res.status(400).json({ message: 'A positive price is required for buy/sell transactions' });
      }
    }

    const uppercaseSymbol = symbol.toUpperCase().trim();

    // 1. Create transaction
    const newTx = new PortfolioTransaction({
      userId: req.user.id,
      symbol: uppercaseSymbol,
      type,
      quantity: quantity || 0,
      price: price || 0,
      amount,
      date: date || new Date(),
      notes
    });

    // 2. Find or create the corresponding Holding
    let holding = await Holding.findOne({ userId: req.user.id, symbol: uppercaseSymbol });

    if (type === 'buy') {
      if (!holding) {
        // Query search directory to resolve ticker description and type
        let assetName = uppercaseSymbol;
        let assetType = 'stock';
        let exchange = 'NSE';

        try {
          const mlRes = await fetch(`${ML_SERVICE_URL}/portfolio/search?q=${encodeURIComponent(uppercaseSymbol)}`);
          if (mlRes.ok) {
            const searchResults = await mlRes.json();
            const matchingSymbol = searchResults.find(s => s.symbol.toUpperCase() === uppercaseSymbol);
            if (matchingSymbol) {
              assetName = matchingSymbol.name;
              assetType = matchingSymbol.type === 'mutualfund' ? 'mutual_fund' : matchingSymbol.type === 'etf' ? 'gold' : 'stock';
              exchange = matchingSymbol.exchange || 'NSE';
            }
          }
        } catch (err) {
          console.error('Error fetching ticker details during transaction logging:', err.message);
        }

        holding = new Holding({
          userId: req.user.id,
          symbol: uppercaseSymbol,
          name: assetName,
          assetType,
          exchange,
          quantity: 0,
          avgBuyPrice: 0
        });
      }

      // Recalculate average purchase price (Weighted Average Cost)
      const newQuantity = holding.quantity + quantity;
      const totalCost = (holding.quantity * holding.avgBuyPrice) + (quantity * price);
      holding.avgBuyPrice = newQuantity > 0 ? totalCost / newQuantity : 0;
      holding.quantity = newQuantity;
      await holding.save();
      newTx.holdingId = holding._id;

    } else if (type === 'sell') {
      if (!holding || holding.quantity < quantity) {
        return res.status(400).json({ message: 'Insufficient holdings to complete this sale.' });
      }

      holding.quantity -= quantity;
      if (holding.quantity === 0) {
        await Holding.deleteOne({ _id: holding._id });
      } else {
        await holding.save();
      }
      newTx.holdingId = holding._id;
    } else if (type === 'dividend' || type === 'interest') {
      if (holding) {
        newTx.holdingId = holding._id;
      }
    }

    await newTx.save();
    res.json(newTx);
  } catch (err) {
    console.error('POST transaction error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    GET api/portfolio/transactions
// @desc     Get all user portfolio transaction logs
// @access   Private
router.get('/transactions', auth, async (req, res) => {
  try {
    const transactions = await PortfolioTransaction.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    console.error('GET transactions error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    DELETE api/portfolio/transaction/:id
// @desc     Delete a transaction log (and revert holding calculations)
// @access   Private
router.delete('/transaction/:id', auth, async (req, res) => {
  try {
    const tx = await PortfolioTransaction.findById(req.params.id);
    if (!tx) {
      return res.status(404).json({ message: 'Transaction log not found' });
    }

    if (tx.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Attempt to revert changes in corresponding holding if possible
    let holding = await Holding.findOne({ userId: req.user.id, symbol: tx.symbol });
    if (holding) {
      if (tx.type === 'buy') {
        const remainingQty = holding.quantity - tx.quantity;
        if (remainingQty <= 0) {
          await Holding.deleteOne({ _id: holding._id });
        } else {
          const totalCost = (holding.quantity * holding.avgBuyPrice) - (tx.quantity * tx.price);
          holding.avgBuyPrice = remainingQty > 0 ? Math.max(0, totalCost / remainingQty) : 0;
          holding.quantity = remainingQty;
          await holding.save();
        }
      } else if (tx.type === 'sell') {
        holding.quantity += tx.quantity;
        await holding.save();
      }
    }

    await PortfolioTransaction.deleteOne({ _id: req.params.id });
    res.json({ message: 'Transaction log removed' });
  } catch (err) {
    console.error('DELETE transaction error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    POST api/portfolio/analyze
// @desc     Proxy risk score and rebalancing requests to Flask ML service
// @access   Private
router.post('/analyze', auth, async (req, res) => {
  try {
    const { riskProfile, holdings } = req.body;

    const mlRes = await fetch(`${ML_SERVICE_URL}/portfolio/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ riskProfile, holdings })
    });

    if (mlRes.ok) {
      const data = await mlRes.json();
      return res.json(data);
    }

    res.status(500).json({ message: 'Error from advisor analytics engine' });
  } catch (err) {
    console.error('Portfolio analyze proxy error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    GET api/portfolio/search
// @desc     Search stocks or mutual funds via ML proxy
// @access   Private
router.get('/search', auth, async (req, res) => {
  const query = req.query.q || '';
  if (!query) {
    return res.json([]);
  }

  try {
    const mlRes = await fetch(`${ML_SERVICE_URL}/portfolio/search?q=${encodeURIComponent(query)}`);
    if (mlRes.ok) {
      const data = await mlRes.json();
      return res.json(data);
    }
    res.status(500).json({ message: 'Error querying search directory' });
  } catch (err) {
    console.error('Search proxy error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Backward-compatibility: delete a direct holding
router.delete('/:id', auth, async (req, res) => {
  try {
    const holding = await Holding.findById(req.params.id);
    if (!holding) {
      return res.status(404).json({ message: 'Holding not found' });
    }

    if (holding.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Holding.deleteOne({ _id: req.params.id });
    res.json({ message: 'Holding removed' });
  } catch (err) {
    console.error('DELETE holding legacy error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
