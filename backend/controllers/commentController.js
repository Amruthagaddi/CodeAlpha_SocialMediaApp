const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Notification = require('../models/Notification');

// @desc    Get comments for a post
// @route   GET /api/posts/:id/comments
// @access  Public
const getCommentsByPost = async (req, res) => {
  try {
    const postId = req.params.id;

    const comments = await Comment.find({ post: postId })
      .populate('author', 'name username profilePicture')
      .sort({ createdAt: 1 });

    return res.status(200).json({ comments });
  } catch (error) {
    console.error('Error in getCommentsByPost:', error);
    return res.status(500).json({ message: 'Server error fetching comments' });
  }
};

// @desc    Add a comment to a post (with notification)
// @route   POST /api/posts/:id/comments
// @access  Private
const addComment = async (req, res) => {
  try {
    const postId = req.params.id;
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Comment text cannot be empty' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = await Comment.create({
      post: postId,
      author: req.user._id,
      text: text.trim()
    });

    const populatedComment = await Comment.findById(comment._id).populate(
      'author',
      'name username profilePicture'
    );

    const commentsCount = await Comment.countDocuments({ post: postId });

    // Create notification if commenter is not the post author
    if (post.author.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: post.author,
        sender: req.user._id,
        type: 'comment',
        post: post._id
      });
    }

    return res.status(201).json({
      message: 'Comment added successfully',
      comment: populatedComment,
      commentsCount
    });
  } catch (error) {
    console.error('Error in addComment:', error);
    return res.status(500).json({ message: 'Server error adding comment' });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Private
const deleteComment = async (req, res) => {
  try {
    const commentId = req.params.id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const post = await Post.findById(comment.post);

    const isCommentAuthor = comment.author.toString() === req.user._id.toString();
    const isPostAuthor = post && post.author.toString() === req.user._id.toString();

    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({ message: 'Unauthorized: You can only delete your own comments' });
    }

    const postId = comment.post;
    await comment.deleteOne();

    const commentsCount = await Comment.countDocuments({ post: postId });

    return res.status(200).json({
      message: 'Comment deleted successfully',
      commentsCount
    });
  } catch (error) {
    console.error('Error in deleteComment:', error);
    return res.status(500).json({ message: 'Server error deleting comment' });
  }
};

module.exports = {
  getCommentsByPost,
  addComment,
  deleteComment
};
