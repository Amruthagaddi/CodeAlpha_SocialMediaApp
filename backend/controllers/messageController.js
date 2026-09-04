const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Get active direct message conversations for followers/connections
// @route   GET /api/messages/conversations
// @access  Private
const getConversations = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const currentUser = await User.findById(currentUserId);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followers = currentUser.followers || [];
    const following = currentUser.following || [];

    // Find all users with whom current user has exchanged messages
    const messageRecords = await Message.find({
      $or: [{ sender: currentUserId }, { recipient: currentUserId }]
    }).select('sender recipient');

    const chattedUserIds = new Set();
    messageRecords.forEach((m) => {
      if (m.sender.toString() !== currentUserId.toString()) {
        chattedUserIds.add(m.sender.toString());
      }
      if (m.recipient.toString() !== currentUserId.toString()) {
        chattedUserIds.add(m.recipient.toString());
      }
    });

    // Combine followers, following, and chatted user IDs
    const connectedIdsSet = new Set([
      ...followers.map((id) => id.toString()),
      ...following.map((id) => id.toString()),
      ...chattedUserIds
    ]);

    const connectedUserIds = Array.from(connectedIdsSet);

    const connectedUsers = await User.find({ _id: { $in: connectedUserIds } }).select(
      'name username profilePicture bio'
    );

    const conversations = await Promise.all(
      connectedUsers.map(async (u) => {
        const lastMessage = await Message.findOne({
          $or: [
            { sender: currentUserId, recipient: u._id },
            { sender: u._id, recipient: currentUserId }
          ]
        }).sort({ createdAt: -1 });

        const unreadCount = await Message.countDocuments({
          sender: u._id,
          recipient: currentUserId,
          read: false
        });

        return {
          user: u,
          lastMessage: lastMessage ? lastMessage.text : null,
          lastMessageTime: lastMessage ? lastMessage.createdAt : null,
          unreadCount
        };
      })
    );

    // Sort conversations by latest message timestamp
    conversations.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error('Error in getConversations:', error);
    return res.status(500).json({ message: 'Server error fetching conversations' });
  }
};

// @desc    Get message thread with a specific user
// @route   GET /api/messages/:userId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;

    const targetUser = await User.findById(targetUserId).select('name username profilePicture bio');
    if (!targetUser) {
      return res.status(404).json({ message: 'Recipient user not found' });
    }

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: targetUserId },
        { sender: targetUserId, recipient: currentUserId }
      ]
    }).sort({ createdAt: 1 });

    // Mark incoming messages as read
    await Message.updateMany(
      { sender: targetUserId, recipient: currentUserId, read: false },
      { read: true }
    );

    return res.status(200).json({
      targetUser,
      messages
    });
  } catch (error) {
    console.error('Error in getMessages:', error);
    return res.status(500).json({ message: 'Server error fetching messages' });
  }
};

// @desc    Send a direct message
// @route   POST /api/messages/:userId
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Message content cannot be empty' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Recipient user not found' });
    }

    const message = await Message.create({
      sender: currentUserId,
      recipient: targetUserId,
      text: text.trim()
    });

    return res.status(201).json({
      message: 'Message sent',
      chatMessage: message
    });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    return res.status(500).json({ message: 'Server error sending message' });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage
};
