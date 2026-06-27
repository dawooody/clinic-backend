const { Notification, User } = require('../models');
const admin = require('../config/firebase');

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
const notify = async (
  user_id,
  title,
  body,
  type = 'general',
  data = null
) => {
  try {

    // 1. Save notification in database
    await Notification.create({
      user_id,
      title,
      body,
      type,
      data,
    });

    // 2. Get user's FCM token
    const user = await User.findByPk(user_id);

    // 3. Send push notification if token exists
    if (user && user.fcm_token) {

      await admin.messaging().send({

        token: user.fcm_token,

        notification: {
          title,
          body,
        },

        data: data
          ? Object.fromEntries(
              Object.entries(data).map(([key, value]) => [
                key,
                String(value),
              ])
            )
          : {},

      });

      console.log(`✅ Push notification sent to ${user.email}`);

    }

  } catch (err) {

    console.error(
      '⚠️ Notification failed:',
      err.message
    );

  }
};

module.exports = notify;
