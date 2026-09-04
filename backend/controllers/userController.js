const path = require('path');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const Message = require('../models/Message');
const { uploadToMinio } = require('../config/minio');

// @desc    Get user profile by ID
// @route   GET /api/users/:id
// @access  Public (optional auth token context)
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found on Mitra' });
    }

    const postsCount = await Post.countDocuments({ author: user._id });

    let isFollowing = false;
    let hasRequestedFollow = false;

    const userFollowers = user.followers || [];
    const userFollowRequests = user.followRequests || [];

    if (req.user) {
      const currentUserIdStr = req.user._id.toString();
      isFollowing = userFollowers.some((f) => f.toString() === currentUserIdStr);
      hasRequestedFollow = userFollowRequests.some((r) => r.toString() === currentUserIdStr);
    }

    const isSelf = req.user && req.user._id.toString() === user._id.toString();
    const canViewContent = !user.isPrivate || isFollowing || isSelf;

    return res.status(200).json({
      user: {
        ...user.toJSON(),
        followersCount: userFollowers.length,
        followingCount: (user.following || []).length,
        postsCount,
        isFollowing,
        hasRequestedFollow,
        canViewContent
      }
    });
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return res.status(500).json({ message: 'Server error fetching user profile' });
  }
};

// @desc    Update user profile details or avatar
// @route   PUT /api/users/:id
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Unauthorized: You can only update your own Mitra profile' });
    }

    const { name, username, bio, profilePicture, isPrivate } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name.trim();
    if (username) {
      const cleanUsername = username.trim().toLowerCase();
      const existing = await User.findOne({ username: cleanUsername, _id: { $ne: user._id } });
      if (existing) {
        return res.status(400).json({ message: 'Username is already taken by another user' });
      }
      user.username = cleanUsername;
    }

    if (bio !== undefined) {
      user.bio = bio && bio.trim() !== '' ? bio.trim() : null;
    }

    if (isPrivate !== undefined) {
      user.isPrivate = isPrivate === 'true' || isPrivate === true;
    }

    if (req.file) {
      const ext = path.extname(req.file.originalname) || '.jpg';
      const objectName = `profiles/${user._id}/${Date.now()}${ext.toLowerCase()}`;
      user.profilePicture = await uploadToMinio(req.file.buffer, objectName, req.file.mimetype);
    } else if (profilePicture !== undefined) {
      user.profilePicture = profilePicture ? profilePicture.trim() : null;
    }

    await user.save();

    const postsCount = await Post.countDocuments({ author: user._id });
    const followers = user.followers || [];
    const following = user.following || [];

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        ...user.toJSON(),
        followersCount: followers.length,
        followingCount: following.length,
        postsCount
      }
    });
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    return res.status(500).json({ message: 'Server error updating user profile' });
  }
};

// @desc    Toggle user account privacy (Public vs Private)
// @route   PUT /api/users/privacy
// @access  Private
const updatePrivacy = async (req, res) => {
  try {
    const { isPrivate } = req.body;
    const user = await User.findById(req.user._id);

    user.isPrivate = isPrivate === true || isPrivate === 'true';
    await user.save();

    return res.status(200).json({
      message: `Account is now ${user.isPrivate ? 'Private' : 'Public'}`,
      isPrivate: user.isPrivate
    });
  } catch (error) {
    console.error('Error in updatePrivacy:', error);
    return res.status(500).json({ message: 'Server error updating privacy setting' });
  }
};

// @desc    Permanently delete account and all associated data
// @route   DELETE /api/users/me
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Delete user posts & associated post comments
    const userPosts = await Post.find({ author: userId });
    const userPostIds = userPosts.map((p) => p._id);
    await Comment.deleteMany({ post: { $in: userPostIds } });
    await Post.deleteMany({ author: userId });

    // 2. Delete user comments on other posts
    await Comment.deleteMany({ author: userId });

    // 3. Delete user notifications & messages
    await Notification.deleteMany({ $or: [{ recipient: userId }, { sender: userId }] });
    await Message.deleteMany({ $or: [{ recipient: userId }, { sender: userId }] });

    // 4. Remove user ID from all followers, following, and followRequests lists
    await User.updateMany(
      {},
      {
        $pull: {
          followers: userId,
          following: userId,
          followRequests: userId
        }
      }
    );

    // 5. Delete User document
    await User.findByIdAndDelete(userId);

    return res.status(200).json({ message: 'Your Mitra account and all associated data have been permanently deleted.' });
  } catch (error) {
    console.error('Error in deleteAccount:', error);
    return res.status(500).json({ message: 'Server error deleting account' });
  }
};

// @desc    Search users by username or name (handles empty query cleanly)
// @route   GET /api/users/search OR /api/users/search/:query
// @access  Public (optional auth for status)
const searchUsers = async (req, res) => {
  try {
    const query = req.params.query;
    let queryFilter = {};

    if (query && query.trim() !== '') {
      const searchRegex = new RegExp(query.trim(), 'i');
      queryFilter = {
        $or: [{ name: searchRegex }, { username: searchRegex }]
      };
    }

    const users = await User.find(queryFilter)
      .select('-password')
      .limit(30);

    const currentUserIdStr = req.user ? req.user._id.toString() : null;

    const formattedUsers = users.map((u) => {
      const followers = u.followers || [];
      const followRequests = u.followRequests || [];
      const following = u.following || [];

      let isFollowing = false;
      let hasRequestedFollow = false;

      if (currentUserIdStr) {
        isFollowing = followers.some((f) => f.toString() === currentUserIdStr);
        hasRequestedFollow = followRequests.some((r) => r.toString() === currentUserIdStr);
      }

      return {
        ...u.toJSON(),
        followersCount: followers.length,
        followingCount: following.length,
        isFollowing,
        hasRequestedFollow
      };
    });

    return res.status(200).json({ users: formattedUsers });
  } catch (error) {
    console.error('Error in searchUsers:', error);
    return res.status(500).json({ message: 'Server error searching users' });
  }
};

// @desc    Follow a user (or send follow request if account is private)
// @route   POST /api/users/:id/follow
// @access  Private
const followUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself on Mitra' });
    }

    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser) {
      return res.status(404).json({ message: 'User to follow not found' });
    }

    if (!targetUser.followers) targetUser.followers = [];
    if (!targetUser.followRequests) targetUser.followRequests = [];
    if (!currentUser.following) currentUser.following = [];

    const alreadyFollowing = currentUser.following.some((id) => id.toString() === targetUserId);
    if (alreadyFollowing) {
      return res.status(400).json({ message: 'You are already following this user' });
    }

    // Handle Private Account Follow Request Flow
    if (targetUser.isPrivate) {
      const alreadyRequested = targetUser.followRequests.some((id) => id.toString() === currentUserId.toString());
      if (!alreadyRequested) {
        targetUser.followRequests.push(currentUserId);
        await targetUser.save();

        await Notification.create({
          recipient: targetUserId,
          sender: currentUserId,
          type: 'follow_request'
        });
      }

      return res.status(200).json({
        message: `Follow request sent to ${targetUser.name}`,
        isFollowing: false,
        isRequested: true,
        followersCount: targetUser.followers.length
      });
    }

    // Public Account Direct Follow Flow
    currentUser.following.push(targetUserId);
    targetUser.followers.push(currentUserId);

    await currentUser.save();
    await targetUser.save();

    await Notification.create({
      recipient: targetUserId,
      sender: currentUserId,
      type: 'follow_accept'
    });

    return res.status(200).json({
      message: `You are now following ${targetUser.name}`,
      isFollowing: true,
      isRequested: false,
      followersCount: targetUser.followers.length
    });
  } catch (error) {
    console.error('Error in followUser:', error);
    return res.status(500).json({ message: 'Server error following user' });
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/users/:id/follow
// @access  Private
const unfollowUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser) {
      return res.status(404).json({ message: 'User to unfollow not found' });
    }

    if (!currentUser.following) currentUser.following = [];
    if (!targetUser.followers) targetUser.followers = [];
    if (!targetUser.followRequests) targetUser.followRequests = [];

    currentUser.following = currentUser.following.filter(
      (id) => id.toString() !== targetUserId
    );
    targetUser.followers = targetUser.followers.filter(
      (id) => id.toString() !== currentUserId.toString()
    );
    targetUser.followRequests = targetUser.followRequests.filter(
      (id) => id.toString() !== currentUserId.toString()
    );

    await currentUser.save();
    await targetUser.save();

    return res.status(200).json({
      message: `You unfollowed ${targetUser.name}`,
      isFollowing: false,
      isRequested: false,
      followersCount: targetUser.followers.length
    });
  } catch (error) {
    console.error('Error in unfollowUser:', error);
    return res.status(500).json({ message: 'Server error unfollowing user' });
  }
};

// @desc    Accept a follow request (for private accounts)
// @route   POST /api/users/:id/accept-follow
// @access  Private
const acceptFollowRequest = async (req, res) => {
  try {
    const requesterId = req.params.id;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    const requesterUser = await User.findById(requesterId);

    if (!requesterUser) {
      return res.status(404).json({ message: 'Requesting user not found' });
    }

    if (!currentUser.followers) currentUser.followers = [];
    if (!currentUser.followRequests) currentUser.followRequests = [];
    if (!requesterUser.following) requesterUser.following = [];

    currentUser.followRequests = currentUser.followRequests.filter(
      (id) => id.toString() !== requesterId
    );

    if (!currentUser.followers.some((id) => id.toString() === requesterId)) {
      currentUser.followers.push(requesterId);
    }
    if (!requesterUser.following.some((id) => id.toString() === currentUserId.toString())) {
      requesterUser.following.push(currentUserId);
    }

    await currentUser.save();
    await requesterUser.save();

    await Notification.deleteMany({
      recipient: currentUserId,
      sender: requesterId,
      type: 'follow_request'
    });

    await Notification.create({
      recipient: requesterId,
      sender: currentUserId,
      type: 'follow_accept'
    });

    return res.status(200).json({ message: `Accepted follow request from ${requesterUser.name}` });
  } catch (error) {
    console.error('Error in acceptFollowRequest:', error);
    return res.status(500).json({ message: 'Server error accepting follow request' });
  }
};

// @desc    Reject a follow request (for private accounts)
// @route   POST /api/users/:id/reject-follow
// @access  Private
const rejectFollowRequest = async (req, res) => {
  try {
    const requesterId = req.params.id;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!currentUser.followRequests) currentUser.followRequests = [];

    currentUser.followRequests = currentUser.followRequests.filter(
      (id) => id.toString() !== requesterId
    );
    await currentUser.save();

    await Notification.deleteMany({
      recipient: currentUserId,
      sender: requesterId,
      type: 'follow_request'
    });

    return res.status(200).json({ message: 'Follow request rejected' });
  } catch (error) {
    console.error('Error in rejectFollowRequest:', error);
    return res.status(500).json({ message: 'Server error rejecting follow request' });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  updatePrivacy,
  deleteAccount,
  searchUsers,
  followUser,
  unfollowUser,
  acceptFollowRequest,
  rejectFollowRequest
};
