const router    = require('express').Router();
const { Specialty } = require('../../models');
const { success, error } = require('../../utils/response');

// GET /api/specialties — public, no auth needed
// Flutter uses this to populate specialty filter and doctor creation form
router.get('/', async (req, res, next) => {
  try {
    const specialties = await Specialty.findAll({
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'description', 'icon'],
    });
    return success(res, specialties);
  } catch (err) {
    next(err);
  }
});

// GET /api/specialties/:id — get one specialty
router.get('/:id', async (req, res, next) => {
  try {
    const specialty = await Specialty.findByPk(req.params.id);
    if (!specialty) return error(res, 'Specialty not found.', 404);
    return success(res, specialty);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
