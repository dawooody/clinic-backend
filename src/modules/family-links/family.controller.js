const service = require('./family.service');
const { success } = require('../../utils/response');

const requestLink = async (req, res, next) => {
  try {
    const data = await service.requestLink(req.user.id, req.body);
    return success(res, data, 'Family link request sent', 201);
  } catch (err) {
    next(err);
  }
};

const acceptLink = async (req, res, next) => {
  try {
    const data = await service.respondToLink(req.user.id, req.params.id, 'accept');
    return success(res, data, 'Family link accepted');
  } catch (err) {
    next(err);
  }
};

const rejectLink = async (req, res, next) => {
  try {
    const data = await service.respondToLink(req.user.id, req.params.id, 'reject');
    return success(res, data, 'Family link rejected');
  } catch (err) {
    next(err);
  }
};

const getMyFamily = async (req, res, next) => {
  try {
    const data = await service.getMyFamily(req.user.id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getPending = async (req, res, next) => {
  try {
    const data = await service.getPendingRequests(req.user.id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

module.exports = { requestLink, acceptLink, rejectLink, getMyFamily, getPending };