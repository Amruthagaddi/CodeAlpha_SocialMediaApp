const path = require('path');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { uploadToMinio } = require('../config/minio');

// @desc    Get all feed posts or filter by userId (respecting privacy)
// @route   GET /api/posts
// @access  Public (optional auth for like status & privacy)
const getPosts = async (req, res) => {
  try {
    const { userId } = req.query;
    let queryFilter = {};

    if (userId) {
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      const currentUserIdStr = req.user ? req.user._id.toString() : null;
      const isSelf = currentUserIdStr === userId;
      const isFollowing = currentUserIdStr
        ? targetUser.followers.some((f) => f.toString() === currentUserIdStr)
        : false;

      // Privacy Check: If account is private and viewer is not following / not self
      if (targetUser.isPrivate && !isFollowing && !isSelf) {
        return res.status(200).json({ posts: [], isPrivateAccount: true });
      }

      queryFilter.author = userId;
    } else if (req.user) {
      // Feed filter: user's posts + posts from users they follow
      const currentUser = await User.findById(req.user._id);
      const followingIds = currentUser ? currentUser.following : [];
      queryFilter.author = { $in: [req.user._id, ...followingIds] };
    }

    let posts = await Post.find(queryFilter)
      .populate('author', 'name username profilePicture isPrivate')
      .sort({ createdAt: -1 });

    // Fallback: If feed is empty and no specific userId filter was requested, load recent public posts
    if (posts.length === 0 && !userId) {
      const publicUsers = await User.find({ isPrivate: false }).select('_id');
      const publicUserIds = publicUsers.map((u) => u._id);

      posts = await Post.find({ author: { $in: publicUserIds } })
        .populate('author', 'name username profilePicture isPrivate')
        .sort({ createdAt: -1 })
        .limit(30);
    }

    const currentUserIdStr = req.user ? req.user._id.toString() : null;
    let userSavedPosts = [];
    if (req.user) {
      const u = await User.findById(req.user._id).select('savedPosts');
      userSavedPosts = u && u.savedPosts ? u.savedPosts.map((id) => id.toString()) : [];
    }

    const formattedPosts = await Promise.all(
      posts.map(async (post) => {
        const commentsCount = await Comment.countDocuments({ post: post._id });
        const userHasLiked = currentUserIdStr
          ? post.likes.some((id) => id.toString() === currentUserIdStr)
          : false;

        const isBookmarked = currentUserIdStr ? userSavedPosts.includes(post._id.toString()) : false;

        // Calculate reactions breakdown
        const reactions = post.reactions || [];
        const userReaction = currentUserIdStr
          ? (reactions.find((r) => r.user.toString() === currentUserIdStr) || {}).type || null
          : null;

        const reactionsSummary = {
          love: reactions.filter((r) => r.type === 'love').length,
          fire: reactions.filter((r) => r.type === 'fire').length,
          clap: reactions.filter((r) => r.type === 'clap').length,
          laugh: reactions.filter((r) => r.type === 'laugh').length
        };

        const imageList = post.images && post.images.length > 0 ? post.images : post.image ? [post.image] : [];

        return {
          _id: post._id,
          author: post.author,
          content: post.content,
          image: post.image,
          images: imageList,
          likesCount: post.likes.length,
          userHasLiked,
          isBookmarked,
          userReaction,
          reactionsSummary,
          commentsCount,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt
        };
      })
    );

    return res.status(200).json({ posts: formattedPosts, isPrivateAccount: false });
  } catch (error) {
    console.error('Error in getPosts:', error);
    return res.status(500).json({ message: 'Server error fetching posts' });
  }
};

// @desc    Create a post with optional MinIO image upload (supports single or multiple files)
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res) => {
  try {
    const { content, image } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Post content cannot be empty' });
    }

    let imageUrl = image ? image.trim() : null;
    let imagesList = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ext = path.extname(file.originalname) || '.jpg';
        const objectName = `posts/${req.user._id}/${Date.now()}_${Math.random().toString(36).substring(7)}${ext.toLowerCase()}`;
        const uploadedUrl = await uploadToMinio(file.buffer, objectName, file.mimetype);
        imagesList.push(uploadedUrl);
      }
      imageUrl = imagesList[0];
    } else if (req.file) {
      const ext = path.extname(req.file.originalname) || '.jpg';
      const objectName = `posts/${req.user._id}/${Date.now()}${ext.toLowerCase()}`;
      imageUrl = await uploadToMinio(req.file.buffer, objectName, req.file.mimetype);
      imagesList.push(imageUrl);
    } else if (imageUrl) {
      imagesList.push(imageUrl);
    }

    const post = await Post.create({
      author: req.user._id,
      content: content.trim(),
      image: imageUrl || '',
      images: imagesList
    });

    // Check for @mentions in post content and trigger notification
    const mentions = content.match(/@([a-zA-Z0-9_]{3,30})/g) || [];
    if (mentions.length > 0) {
      for (const mention of mentions) {
        const cleanUsername = mention.replace('@', '').toLowerCase();
        const mentionedUser = await User.findOne({ username: cleanUsername });
        if (mentionedUser && mentionedUser._id.toString() !== req.user._id.toString()) {
          await Notification.create({
            recipient: mentionedUser._id,
            sender: req.user._id,
            type: 'comment',
            post: post._id
          });
        }
      }
    }

    const populatedPost = await Post.findById(post._id).populate(
      'author',
      'name username profilePicture isPrivate'
    );

    return res.status(201).json({
      message: 'Post published on Mitra!',
      post: {
        _id: populatedPost._id,
        author: populatedPost.author,
        content: populatedPost.content,
        image: populatedPost.image,
        images: populatedPost.images,
        likesCount: 0,
        userHasLiked: false,
        isBookmarked: false,
        commentsCount: 0,
        createdAt: populatedPost.createdAt,
        updatedAt: populatedPost.updatedAt
      }
    });
  } catch (error) {
    console.error('Error in createPost:', error);
    return res.status(500).json({ message: 'Server error creating post' });
  }
};

// @desc    Toggle bookmark post for user
// @route   POST /api/posts/:id/bookmark
// @access  Private
const toggleBookmark = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const postId = req.params.id;

    const index = user.savedPosts.indexOf(postId);
    let isBookmarked = false;

    if (index > -1) {
      user.savedPosts.splice(index, 1);
      isBookmarked = false;
    } else {
      user.savedPosts.push(postId);
      isBookmarked = true;
    }

    await user.save();
    return res.status(200).json({
      message: isBookmarked ? 'Post saved to bookmarks' : 'Post removed from bookmarks',
      isBookmarked
    });
  } catch (error) {
    console.error('Error in toggleBookmark:', error);
    return res.status(500).json({ message: 'Server error toggling bookmark' });
  }
};

// @desc    Get bookmarked posts
// @route   GET /api/posts/saved
// @access  Private
const getSavedPosts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'savedPosts',
      populate: { path: 'author', select: 'name username profilePicture isPrivate' }
    });

    const posts = user.savedPosts || [];
    const currentUserIdStr = req.user._id.toString();

    const formattedPosts = await Promise.all(
      posts.map(async (post) => {
        const commentsCount = await Comment.countDocuments({ post: post._id });
        const userHasLiked = post.likes.some((id) => id.toString() === currentUserIdStr);

        return {
          _id: post._id,
          author: post.author,
          content: post.content,
          image: post.image,
          images: post.images && post.images.length > 0 ? post.images : post.image ? [post.image] : [],
          likesCount: post.likes.length,
          userHasLiked,
          isBookmarked: true,
          commentsCount,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt
        };
      })
    );

    return res.status(200).json({ posts: formattedPosts });
  } catch (error) {
    console.error('Error in getSavedPosts:', error);
    return res.status(500).json({ message: 'Server error fetching saved posts' });
  }
};

// @desc    React to a post (love, fire, clap, laugh)
// @route   POST /api/posts/:id/react
// @access  Private
const reactToPost = async (req, res) => {
  try {
    const { reactionType } = req.body; // 'love', 'fire', 'clap', 'laugh'
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const currentUserIdStr = req.user._id.toString();
    const existingIndex = (post.reactions || []).findIndex((r) => r.user.toString() === currentUserIdStr);

    let currentType = null;
    if (existingIndex > -1) {
      if (post.reactions[existingIndex].type === reactionType) {
        // Toggle off
        post.reactions.splice(existingIndex, 1);
        currentType = null;
      } else {
        // Change type
        post.reactions[existingIndex].type = reactionType;
        currentType = reactionType;
      }
    } else {
      // Add new reaction
      post.reactions.push({ user: req.user._id, type: reactionType });
      currentType = reactionType;
    }

    await post.save();

    const reactionsSummary = {
      love: post.reactions.filter((r) => r.type === 'love').length,
      fire: post.reactions.filter((r) => r.type === 'fire').length,
      clap: post.reactions.filter((r) => r.type === 'clap').length,
      laugh: post.reactions.filter((r) => r.type === 'laugh').length
    };

    return res.status(200).json({
      message: 'Reaction updated',
      userReaction: currentType,
      reactionsSummary
    });
  } catch (error) {
    console.error('Error in reactToPost:', error);
    return res.status(500).json({ message: 'Server error updating reaction' });
  }
};

// @desc    Get top trending hashtags
// @route   GET /api/posts/trending/hashtags
// @access  Public
const getTrendingHashtags = async (req, res) => {
  try {
    const recentPosts = await Post.find().sort({ createdAt: -1 }).limit(100).select('content');
    const counts = {};

    recentPosts.forEach((post) => {
      const matches = post.content.match(/#([a-zA-Z0-9_]+)/g) || [];
      matches.forEach((tag) => {
        const lower = tag.toLowerCase();
        counts[lower] = (counts[lower] || 0) + 1;
      });
    });

    const sorted = Object.keys(counts)
      .map((tag) => ({ tag, count: counts[tag] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return res.status(200).json({ hashtags: sorted });
  } catch (error) {
    console.error('Error in getTrendingHashtags:', error);
    return res.status(500).json({ message: 'Server error fetching hashtags' });
  }
};

// @desc    Get single post by ID
// @route   GET /api/posts/:id
// @access  Public
const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name username profilePicture isPrivate');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    return res.status(200).json({ post });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(req.params.id);
    await Comment.deleteMany({ post: req.params.id });

    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error deleting post' });
  }
};

// @desc    Like post
// @route   POST /api/posts/:id/like
// @access  Private
const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const currentUserIdStr = req.user._id.toString();
    const alreadyLiked = post.likes.some((id) => id.toString() === currentUserIdStr);

    if (!alreadyLiked) {
      post.likes.push(req.user._id);
      await post.save();

      if (post.author.toString() !== currentUserIdStr) {
        await Notification.create({
          recipient: post.author,
          sender: req.user._id,
          type: 'like',
          post: post._id
        });
      }
    }

    return res.status(200).json({
      message: 'Post liked',
      likesCount: post.likes.length,
      userHasLiked: true
    });
  } catch (error) {
    console.error('Error in likePost:', error);
    return res.status(500).json({ message: 'Server error liking post' });
  }
};

// @desc    Unlike a post
// @route   DELETE /api/posts/:id/like
// @access  Private
const unlikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const currentUserIdStr = req.user._id.toString();
    post.likes = post.likes.filter((id) => id.toString() !== currentUserIdStr);
    await post.save();

    return res.status(200).json({
      message: 'Post unliked',
      likesCount: post.likes.length,
      userHasLiked: false
    });
  } catch (error) {
    console.error('Error in unlikePost:', error);
    return res.status(500).json({ message: 'Server error unliking post' });
  }
};

module.exports = {
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
};
