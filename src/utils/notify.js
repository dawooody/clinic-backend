const { Notification } = require('../models');

/**
 * Create an in-app notification for a user.
 * Never throws — a failed notification must never crash the main request.
 *
 * @param {string} user_id   - The User.id to notify
 * @param {string} title     - Short title shown in the app
 * @param {string} body      - Full notification message
 * @param {string} type      - 'appointment' | 'prescription' | 'family_link' | 'general'
 * @param {object} data      - Optional extra payload (e.g. { appointment_id })
 */
const notify = async (user_id, title, body, type = 'general', data = null) => {
  try {
    await Notification.create({ user_id, title, body, type, data });
  } catch (err) {
    // Log but never bubble up — notifications are non-critical
    console.error('⚠️  Notification creation failed:', err.message);
  }
};

module.exports = notify;
