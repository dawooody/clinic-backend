const { User, Patient, Doctor } = require('../../models');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../utils/jwt');

/**
 * Register a new user (patient by default)
 * Doctors are created by admin only
 */
const register = async ({ full_name, email, password, phone, role = 'patient' }) => {
  // Check email exists
  const existing = await User.findOne({ where: { email } });
  if (existing) throw { status: 409, message: 'Email already registered.' };
   // Check username exists
  const existingUsername = await User.findOne({ where: { full_name } });
  if (existingUsername) throw { status: 409, message: 'Username already taken.' };

     // ✅ تحقق من رقم التليفون (مصر: يبدأ بـ 010/011/012/015 ويكون 11 رقم)
    const phoneRegex = /^(010|011|012|015)\d{8}$/;
    if (!phoneRegex.test(phone)) {
      return error(res, 'Phone number is not valid.', 400);
    }
   // check password length
     if (password.length < 8) {
      return error(res, 'Password must be at least 8 characters.', 400);
      }
  // Only allow patients to self-register
  if (role !== 'patient') throw { status: 403, message: 'Cannot self-register with this role.' };

  const user = await User.create({ full_name, email, password, phone, role });

  // Create the matching patient profile automatically
  await Patient.create({ user_id: user.id });

  const accessToken  = generateAccessToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user.id });

  // Save refresh token in DB
  await user.update({ refresh_token: refreshToken });

  return {
    user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  };
};

/**
 * Login - returns tokens for the mobile app to store
 */
const login = async ({ email, password }) => {
  const user = await User.findOne({ where: { email } });
  if (!user) throw { status: 401, message: 'Invalid email or password.' };

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

/**
 * Logout — clear refresh token from DB
 */
const logout = async (userId) => {
  await User.update({ refresh_token: null }, { where: { id: userId } });
};

module.exports = { register, login, refreshToken, logout };
