const express = require('express');
const router = express.Router();
const path = require('path');
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { uploadToMinio } = require('../config/minio');
const User = require('../models/User');

// @desc    Upload profile picture to MinIO
// @route   POST /api/upload/profile
// @access  Private
router.post('/profile', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please select an image file to upload.' });
    }

    const userId = req.user._id.toString();
    const ext = path.extname(req.file.originalname) || '.jpg';
    const objectName = `profiles/${userId}/${Date.now()}${ext.toLowerCase()}`;

    const mediaUrl = await uploadToMinio(req.file.buffer, objectName, req.file.mimetype);

    // Update user profile picture reference in MongoDB
    await User.findByIdAndUpdate(userId, { profilePicture: mediaUrl });

    return res.status(200).json({
      message: 'Profile picture uploaded successfully',
      profilePicture: mediaUrl
    });
  } catch (error) {
    console.error('Error in profile upload:', error);
    return res.status(500).json({ message: error.message || 'Failed to upload profile picture' });
  }
});

// @desc    Upload post image to MinIO
// @route   POST /api/upload/post
// @access  Private
router.post('/post', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please select an image file to upload.' });
    }

    const userId = req.user._id.toString();
    const ext = path.extname(req.file.originalname) || '.jpg';
    const objectName = `posts/${userId}/${Date.now()}${ext.toLowerCase()}`;

    const mediaUrl = await uploadToMinio(req.file.buffer, objectName, req.file.mimetype);

    return res.status(200).json({
      message: 'Post image uploaded successfully',
      imageUrl: mediaUrl
    });
  } catch (error) {
    console.error('Error in post image upload:', error);
    return res.status(500).json({ message: error.message || 'Failed to upload post image' });
  }
});

module.exports = router;
