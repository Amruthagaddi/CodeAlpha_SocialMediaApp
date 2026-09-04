const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markNotificationsRead,
  deleteNotification
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getNotifications);
router.put('/read', protect, markNotificationsRead);
router.delete('/:id', protect, deleteNotification);

module.exports = router;
