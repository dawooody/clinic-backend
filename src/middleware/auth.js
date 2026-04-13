const { verifyAccessToken } = require('../utils/jwt');
const { error } = require('../utils/response');
const { User } = require('../models');

/**
 * Protect routes
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'No token provided. Please login.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password', 'refresh_token'] },
    });

    if (!user) {
      return error(res, 'User no longer exists.', 401);
    }

    if (!user.is_active) {
      return error(res, 'Your account has been deactivated.', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired. Please login again.', 401);
    }
    return error(res, 'Invalid token.', 401);
  }
};

/**
 * Role-based access control
 */
const roles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Unauthorized', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return error(res, 'Forbidden: insufficient permissions', 403);
    }

    next();
  };
};

module.exports = {
  protect,
  roles,
};