const Notification = require('../models/Notification');

// @desc    Get current user notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'name username profilePicture')
      .populate('post', 'content')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });

    return res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error in getNotifications:', error);
    return res.status(500).json({ message: 'Server error fetching notifications' });
  }
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/read
// @access  Private
const markNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    );
    return res.status(200).json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error in markNotificationsRead:', error);
    return res.status(500).json({ message: 'Server error updating notifications' });
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized action' });
    }

    await notification.deleteOne();
    return res.status(200).json({ message: 'Notification removed' });
  } catch (error) {
    console.error('Error in deleteNotification:', error);
    return res.status(500).json({ message: 'Server error deleting notification' });
  }
};

module.exports = {
  getNotifications,
  markNotificationsRead,
  deleteNotification
};
