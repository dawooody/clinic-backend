const { error } = require('../utils/response');

/**
 * Usage: router.get('/path', protect, roles('doctor', 'admin'), controller)
 */
const roles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Not authenticated.', 401);
    }
    if (!allowedRoles.includes(req.user.role)) {
      return error(res, `Access denied. Required role: ${allowedRoles.join(' or ')}`, 403);
    }
    next();
  };
};

module.exports = { roles };
