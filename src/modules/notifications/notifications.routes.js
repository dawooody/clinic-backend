const router = require('express').Router();
const { Notification } = require('../../models');
const { protect }      = require('../../middleware/auth');
const { success, error, paginated } = require('../../utils/response');

// Get all my notifications (newest first)
router.get('/', protect, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { rows, count } = await Notification.findAndCountAll({
      where:  { user_id: req.user.id },
      order:  [['created_at', 'DESC']],
      limit:  parseInt(limit),
      offset,
    });

    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
});

// Get count of unread notifications (for the badge on mobile)
router.get('/unread-count', protect, async (req, res, next) => {
  try {
    const count = await Notification.count({ where: { user_id: req.user.id, is_read: false } });
    return success(res, { unread_count: count });
  } catch (err) { next(err); }
});

// Mark all notifications as read
router.put('/read-all', protect, async (req, res, next) => {
  try {
    await Notification.update({ is_read: true }, { where: { user_id: req.user.id, is_read: false } });
    return success(res, {}, 'All notifications marked as read');
  } catch (err) { next(err); }
});

// Mark a single notification as read
router.put('/:id/read', protect, async (req, res, next) => {
  try {
    const notif = await Notification.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!notif) return error(res, 'Notification not found.', 404);
    await notif.update({ is_read: true });
    return success(res, notif, 'Notification marked as read');
  } catch (err) { next(err); }
});

// Delete a single notification
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const notif = await Notification.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!notif) return error(res, 'Notification not found.', 404);
    await notif.destroy();
    return success(res, {}, 'Notification deleted');
  } catch (err) { next(err); }
});

module.exports = router;
