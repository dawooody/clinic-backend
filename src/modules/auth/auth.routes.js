const router = require('express').Router();
const ctrl   = require('./auth.controller');
const { protect }  = require('../../middleware/auth');
const { User }     = require('../../models');
const { success, error } = require('../../utils/response');
const sendEmail = require('../../utils/sendEmail');

// ─── Public routes ───────────────────────────────────────────────────────────
router.post('/register',      ctrl.register);
router.post('/verify-email', ctrl.verifyEmail);
router.post('/login',         ctrl.login);
router.post('/refresh-token', ctrl.refreshToken);

// ─── Forgot / Reset password ─────────────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {

    const { email } = req.body;

    if (!email) {
      return error(res, 'Email is required.', 400);
    }

    const user = await User.findOne({
      where: { email },
    });

    // Security:
    // Never reveal if email exists or not
    if (!user) {
      return success(
        res,
        {},
        'If this email exists, a reset code has been sent.'
      );
    }

    const code = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const expiry = new Date(
      Date.now() + 15 * 60 * 1000
    );

    await user.update({
      reset_code: code,
      reset_code_expiry: expiry,
    });

    // Send email using Resend
    await sendEmail(
      user.email,
      'Password Reset Code',
      `
        <h2>Password Reset</h2>

        <p>Your reset code is:</p>

        <h1>${code}</h1>

        <p>This code expires in 15 minutes.</p>
      `
    );

    return success(
      res,
      {},
      'Reset code sent to email.'
    );

  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, code, new_password } = req.body;
    if (!email || !code || !new_password) {
      return error(res, 'email, code, and new_password are required.', 400);
    }
    if (new_password.length < 6) {
      return error(res, 'Password must be at least 6 characters.', 400);
    }

    const user = await User.findOne({ where: { email } });
    if (!user || user.reset_code !== code) {
      return error(res, 'Invalid or incorrect reset code.', 400);
    }
    if (new Date() > new Date(user.reset_code_expiry)) {
      return error(res, 'Reset code expired. Please request a new one.', 400);
    }

    await user.update({ password: new_password, reset_code: null, reset_code_expiry: null });
    return success(res, {}, 'Password reset successfully. You can now login.');
  } catch (err) { next(err); }
});

// ─── Protected routes ────────────────────────────────────────────────────────
router.post('/logout', protect, ctrl.logout);
router.get('/me',      protect, ctrl.getMe);

router.put('/change-password', protect, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return error(res, 'current_password and new_password are required.', 400);
    }
    if (new_password.length < 6) {
      return error(res, 'New password must be at least 6 characters.', 400);
    }
    const user = await User.findByPk(req.user.id);
    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) return error(res, 'Current password is incorrect.', 401);

    await user.update({ password: new_password });
    return success(res, {}, 'Password changed successfully.');
  } catch (err) { next(err); }
});

module.exports = router;
