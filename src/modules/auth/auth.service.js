const { User, Patient, Doctor } = require('../../models');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const sendEmail = require('../../utils/sendEmail');

/**
 * Register a new user (patient by default)
 * Doctors are created by admin only
 */
const register = async ({ full_name, email, password, phone, role = 'patient' }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw { status: 409, message: 'Email already registered.' };

  const existingUsername = await User.findOne({ where: { full_name } });
  if (existingUsername) throw { status: 409, message: 'Username already taken.' };

  const phoneRegex = /^(010|011|012|015)\d{8}$/;
  if (!phoneRegex.test(phone)) {
    throw { status: 400, message: 'Phone number is not valid. Must start with 010/011/012/015 and be 11 digits.' };
  }

  if (password.length < 8) {
    throw { status: 400, message: 'Password must be at least 8 characters.' };
  }

  if (role !== 'patient') throw { status: 403, message: 'Cannot self-register with this role.' };

  const user = await User.create({ full_name, email, password, phone, role });
  await Patient.create({ user_id: user.id });

   // Generate OTP
  const verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

    // Save OTP
  user.verification_code = verificationCode;

  user.verification_code_expiry = new Date(
    Date.now() + 10 * 60 * 1000
  );

  await user.save();

    // Send verification email
  try {
  await sendEmail(
    user.email,
    'Verify Your Email',
    `
      <h2>Welcome to our app</h2>

      <p>Your verification code is:</p>

      <h1>${verificationCode}</h1>

      <p>This code expires in 10 minutes.</p>
    `
  );
} catch (err) {
  console.error('Email send error:', err);

  throw {
    status: 500,
    message: 'Failed to send verification email.',
  };
}

  // no tokens before verification
  return {
    message: 'Verification code sent to your email.',
  };
 
};

/**
 * Verify Email OTP
 */
const verifyEmail = async (email, code) => {

  const user = await User.findOne({
    where: { email },
  });

  if (!user) {
    throw {
      status: 404,
      message: 'User not found.',
    };
  }

  if (user.is_verified) {
    throw {
      status: 400,
      message: 'User already verified.',
    };
  }

  if (
    user.verification_code !== code 
  ) {
    throw {
      status: 400,
      message: 'Invalid or expired verification code.',
    };
  }

  user.is_verified = true;

  user.verification_code = null;

  user.verification_code_expiry = null;

  await user.save();

  return {
    message: 'Email verified successfully.',
  };
};

const resendVerificationCode = async (email) => {

  const user = await User.findOne({
    where: { email },
  });

  if (!user) {
    throw {
      status: 404,
      message: 'User not found.',
    };
  }

  if (user.is_verified) {
    throw {
      status: 400,
      message: 'User already verified.',
    };
  }

  // Generate new OTP
  const verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  // Save new OTP
  user.verification_code = verificationCode;

  user.verification_code_expiry = new Date(
    Date.now() + 10 * 60 * 1000
  );

  await user.save();

  // Send email
  await sendEmail(
    user.email,
    'New Verification Code',
    `
      <h2>Email Verification</h2>

      <p>Your new verification code is:</p>

      <h1>${verificationCode}</h1>

      <p>This code expires in 10 minutes.</p>
    `
  );

  return {
    message: 'New verification code sent.',
  };
};

/**
 * Login - returns tokens for the mobile app to store
 */
const login = async ({ email, password }) => {
  const user = await User.findOne({ where: { email } });
  if (!user) throw { status: 401, message: 'Invalid email or password.' };

  // NEW
  if (!user.is_verified) {
    throw {
      status: 403,
      message: 'Please verify your email first.',
    };
  }

  if (!user.is_active) throw { status: 403, message: 'Account deactivated. Contact admin.' };

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw { status: 401, message: 'Invalid email or password.' };

  const accessToken  = generateAccessToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user.id });

  await user.update({ refresh_token: refreshToken });

  return {
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      profile_photo: user.profile_photo,
    },
    accessToken,
    refreshToken,
  };
};

/**
 * Refresh token — mobile apps need this to stay logged in without re-entering password
 */
const refreshToken = async (token) => {
  if (!token) throw { status: 401, message: 'Refresh token required.' };

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw { status: 401, message: 'Invalid or expired refresh token. Please login again.' };
  }

  const user = await User.findByPk(decoded.id);
  if (!user || user.refresh_token !== token) {
    throw { status: 401, message: 'Refresh token mismatch. Please login again.' };
  }

  const newAccessToken  = generateAccessToken({ id: user.id, role: user.role });
  const newRefreshToken = generateRefreshToken({ id: user.id });
  await user.update({ refresh_token: newRefreshToken });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

const saveFcmToken = async (userId, fcm_token) => {

  const user = await User.findByPk(userId);

  if (!user) {
    throw {
      status: 404,
      message: 'User not found.'
    };
  }

  await user.update({
    fcm_token
  });

  return {
    message: 'FCM token saved.'
  };
};

/**
 * Logout — clear refresh token from DB
 */
const logout = async (userId) => {
  await User.update({ refresh_token: null }, { where: { id: userId } });
};

module.exports = { register, verifyEmail, resendVerificationCode, login, refreshToken, saveFcmToken, logout };
