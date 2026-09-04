const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const User = require('../models/User');
const { uploadToMinio } = require('../config/minio');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'mitra_jwt_secret_key_2026', {
    expiresIn: '7d'
  });
};

// @desc    Register a new Mitra user (with optional avatar upload to MinIO or Skip option)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, username, email, password, confirmPassword, bio, skipProfileSetup } = req.body;

    // Field validation
    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields: Full Name, Username, Email, and Password.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check existing accounts
    const existingUsername = await User.findOne({ username: cleanUsername });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username is already taken on Mitra.' });
    }

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let profilePictureUrl = null;
    let userBio = null;

    // If skip profile setup is NOT requested, process bio if provided
    if (skipProfileSetup !== 'true' && skipProfileSetup !== true) {
      if (bio && bio.trim() !== '') {
        userBio = bio.trim();
      }
    }

    // Create user in DB first
    const user = await User.create({
      name: name.trim(),
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      profilePicture: null,
      bio: userBio
    });

    // If a profile picture file was uploaded during registration
    if (req.file && (skipProfileSetup !== 'true' && skipProfileSetup !== true)) {
      try {
        const ext = path.extname(req.file.originalname) || '.jpg';
        const objectName = `profiles/${user._id}/${Date.now()}${ext.toLowerCase()}`;
        profilePictureUrl = await uploadToMinio(req.file.buffer, objectName, req.file.mimetype);
        user.profilePicture = profilePictureUrl;
        await user.save();
      } catch (uploadErr) {
        console.error('Failed to upload profile picture to MinIO during registration:', uploadErr);
      }
    }

    const token = generateToken(user._id);

    return res.status(201).json({
      message: 'Mitra account created successfully!',
      token,
      user
    });
  } catch (error) {
    console.error('Error in registerUser:', error);
    return res.status(500).json({ message: error.message || 'Server error during registration' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const loginIdentifier = email || username || req.body.login;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: 'Please enter your username/email and password.' });
    }

    const cleanIdentifier = loginIdentifier.trim().toLowerCase();

    // Find user by email OR username
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }]
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials. User not found.' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials. Incorrect password.' });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      message: 'Welcome back to Mitra!',
      token,
      user
    });
  } catch (error) {
    console.error('Error in loginUser:', error);
    return res.status(500).json({ message: error.message || 'Server error during login' });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error('Error in getMe:', error);
    return res.status(500).json({ message: 'Server error fetching user profile' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe
};
