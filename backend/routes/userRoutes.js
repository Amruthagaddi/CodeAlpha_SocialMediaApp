const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const {
  getUserProfile,
  updateUserProfile,
  updatePrivacy,
  deleteAccount,
  searchUsers,
  followUser,
  unfollowUser,
  acceptFollowRequest,
  rejectFollowRequest
} = require('../controllers/userController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');

router.delete('/me', protect, deleteAccount);
router.put('/privacy', protect, updatePrivacy);

// Mount search for both /search (empty query) and /search/:query
router.get('/search', optionalProtect, searchUsers);
router.get('/search/:query', optionalProtect, searchUsers);

router.get('/:id', optionalProtect, getUserProfile);
router.put('/:id', protect, upload.single('profilePicture'), updateUserProfile);

router.post('/:id/follow', protect, followUser);
router.delete('/:id/follow', protect, unfollowUser);
router.post('/:id/accept-follow', protect, acceptFollowRequest);
router.post('/:id/reject-follow', protect, rejectFollowRequest);

module.exports = router;
