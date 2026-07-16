const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route    POST api/auth/register
// @desc     Register user
// @access   Public
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user instance
    user = new User({
      username,
      email,
      password
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save to database
    await user.save();

    // Generate JWT
    const payload = {
      id: user.id
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    POST api/auth/login
// @desc     Authenticate user & get token (Login)
// @access   Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    // Check for user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const payload = {
      id: user.id
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    GET api/auth/me
// @desc     Get logged-in user profile
// @access   Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Me endpoint error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    PUT api/auth/profile
// @desc     Update user profile settings
// @access   Private
router.put('/profile', auth, async (req, res) => {
  try {
    const { username, monthlyIncome, currency, avatarColor } = req.body;
    const updates = {};
    if (username !== undefined) updates.username = username.trim();
    if (monthlyIncome !== undefined) updates.monthlyIncome = Number(monthlyIncome);
    if (currency !== undefined) updates.currency = currency;
    if (avatarColor !== undefined) updates.avatarColor = avatarColor;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});


// @route    PUT api/auth/password
// @desc     Change user password (requires current password)
// @access   Private
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password change error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    DELETE api/auth/account
// @desc     Permanently delete user account and ALL associated data
// @access   Private
router.delete('/account', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete all user data in parallel
    const Transaction = require('../models/Transaction');
    const Goal = require('../models/Goal');
    const Budget = require('../models/Budget');
    const Holding = require('../models/Holding');
    const PortfolioTransaction = require('../models/PortfolioTransaction');

    await Promise.all([
      Transaction.deleteMany({ userId }),
      Goal.deleteMany({ userId }),
      Budget.deleteMany({ userId }),
      Holding.deleteMany({ userId }),
      PortfolioTransaction.deleteMany({ userId }),
    ]);

    // Delete user
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account deletion error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
