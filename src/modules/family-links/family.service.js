const notify = require('../../utils/notify');
const { FamilyLink, Patient, User } = require('../../models');
const { Op } = require('sequelize');

const patientWithUser = {
  model: Patient, as: 'requester',
  include: [{ model: User, as: 'user', attributes: ['full_name', 'email', 'profile_photo'] }],
};
const receiverWithUser = {
  model: Patient, as: 'receiver',
  include: [{ model: User, as: 'user', attributes: ['full_name', 'email', 'profile_photo'] }],
};

const requestLink = async (userId, body) => {
  const { receiver_email, relationship } = body;

  if (!receiver_email || !relationship)
    throw { status: 400, message: 'receiver_email and relationship are required.' };

  const validRelationships = ['parent', 'child', 'sibling', 'spouse', 'other'];
  if (!validRelationships.includes(relationship))
    throw { status: 400, message: `relationship must be one of: ${validRelationships.join(', ')}` };

  const myPatient = await Patient.findOne({ where: { user_id: userId } });
  if (!myPatient) throw { status: 404, message: 'Your patient profile not found.' };

  const receiverUser = await User.findOne({ where: { email: receiver_email, role: 'patient' } });
  if (!receiverUser) throw { status: 404, message: 'No patient account found with that email.' };

  const receiverPatient = await Patient.findOne({ where: { user_id: receiverUser.id } });
  if (!receiverPatient) throw { status: 404, message: 'The target user does not have a patient profile yet.' };

  if (myPatient.id === receiverPatient.id)
    throw { status: 400, message: 'You cannot link with yourself.' };

  const existing = await FamilyLink.findOne({
    where: {
      [Op.or]: [
        { requester_id: myPatient.id, receiver_id: receiverPatient.id },
        { requester_id: receiverPatient.id, receiver_id: myPatient.id },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'pending')
      throw { status: 409, message: 'A pending link request already exists.' };
    if (existing.status === 'accepted')
      throw { status: 409, message: 'You are already linked with this person.' };

    // If rejected — allow re-requesting
    await existing.update({
      relationship,
      status: 'pending',
      requester_id: myPatient.id,
      receiver_id: receiverPatient.id,
    });
    return FamilyLink.findByPk(existing.id, { include: [patientWithUser, receiverWithUser] });
  }

  const link = await FamilyLink.create({
    requester_id: myPatient.id,
    receiver_id:  receiverPatient.id,
    relationship,
    status: 'pending',
  });

  try {
    await notify(
      receiverUser.id,
      'Family Link Request',
      'Someone wants to link their profile with yours as a family member.',
      'family_link',
      { link_id: link.id }
    );
  } catch (notifyErr) {
    console.error('Notification failed:', notifyErr.message);
  }

  return FamilyLink.findByPk(link.id, { include: [patientWithUser, receiverWithUser] });
};

const respondToLink = async (userId, linkId, action) => {
  const myPatient = await Patient.findOne({ where: { user_id: userId } });
  if (!myPatient) throw { status: 404, message: 'Patient profile not found.' };

  const link = await FamilyLink.findByPk(linkId);
  if (!link) throw { status: 404, message: 'Family link not found.' };
  if (link.receiver_id !== myPatient.id)
    throw { status: 403, message: 'Only the receiver can respond to this request.' };
  if (link.status !== 'pending')
    throw { status: 400, message: 'This link request has already been responded to.' };

  await link.update({ status: action === 'accept' ? 'accepted' : 'rejected' });
  return FamilyLink.findByPk(linkId, { include: [patientWithUser, receiverWithUser] });
};

const getMyFamily = async (userId) => {
  const myPatient = await Patient.findOne({ where: { user_id: userId } });
  if (!myPatient) throw { status: 404, message: 'Patient profile not found.' };

  const links = await FamilyLink.findAll({
    where: {
      [Op.or]: [{ requester_id: myPatient.id }, { receiver_id: myPatient.id }],
      status: 'accepted',
    },
    include: [patientWithUser, receiverWithUser],
  });

  return links.map((link) => {
    const isRequester = link.requester_id === myPatient.id;
    const member = isRequester ? link.receiver : link.requester;
    return {
      link_id:      link.id,
      relationship: link.relationship,
      member,
    };
  });
};

const getPendingRequests = async (userId) => {
  const myPatient = await Patient.findOne({ where: { user_id: userId } });
  if (!myPatient) throw { status: 404, message: 'Patient profile not found.' };

  return FamilyLink.findAll({
    where: { receiver_id: myPatient.id, status: 'pending' },
    include: [patientWithUser],
  });
};

module.exports = { requestLink, respondToLink, getMyFamily, getPendingRequests };