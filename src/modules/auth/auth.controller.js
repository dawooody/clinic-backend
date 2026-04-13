const authService = require('./auth.service');
const { success, error } = require('../../utils/response');

const register = async (req, res, next) => {
  try {
    const { full_name } = req.body;
    if (!full_name ) {
      return error(res, 'full_name is required.', 400);
    }
    const { email} = req.body;
    if (!email ) {
      return error(res, 'Email is required.', 400);
    }
    const { password } = req.body;
    if (!password ) {
      return error(res, 'Password is required.', 400);
    }
    const { phone } = req.body;
    if (!phone ) {
      return error(res, 'Phone is required.', 400);
    }
   
    const data = await authService.register({ full_name, email, password, phone });
    return success(res, data, 'Registration successful', 201);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return error(res, 'Email and password are required.', 400);
    const data = await authService.login({ email, password });
    return success(res, data, 'Login successful');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    const data = await authService.refreshToken(token);
    return success(res, data, 'Token refreshed');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user.id);
    return success(res, {}, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res) => {
  return success(res, { user: req.user }, 'Current user');
};

module.exports = { register, login, refreshToken, logout, getMe };
