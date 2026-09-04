const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const {
  getPosts,
  createPost,
  getPostById,
  deletePost,
  likePost,
  unlikePost,
  toggleBookmark,
  getSavedPosts,
  reactToPost,
  getTrendingHashtags
} = require('../controllers/postController');
const {
  getCommentsByPost,
  addComment
} = require('../controllers/commentController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, getPosts);
router.post('/', protect, upload.array('images', 4), createPost);
router.get('/saved', protect, getSavedPosts);
router.get('/trending/hashtags', getTrendingHashtags);
router.get('/:id', optionalProtect, getPostById);
router.delete('/:id', protect, deletePost);

// Bookmarks & Reactions
router.post('/:id/bookmark', protect, toggleBookmark);
router.post('/:id/react', protect, reactToPost);

// Likes
router.post('/:id/like', protect, likePost);
router.delete('/:id/like', protect, unlikePost);

// Comments
router.get('/:id/comments', getCommentsByPost);
router.post('/:id/comments', protect, addComment);

module.exports = router;
