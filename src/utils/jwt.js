const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing');
  }

  return process.env.JWT_SECRET;
};

const getJwtRefreshSecret = () => {
  return process.env.JWT_REFRESH_SECRET || getJwtSecret();
};

const generateAccessToken = (payload) => {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, getJwtRefreshSecret(), {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '90d',
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, getJwtRefreshSecret());
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
