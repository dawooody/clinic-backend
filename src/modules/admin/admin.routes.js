const router = require('express').Router();
const ctrl   = require('./admin.controller');
const { protect } = require('../../middleware/auth');
const { roles }   = require('../../middleware/roles');

// All admin routes require login + admin role
router.use(protect, roles('admin'));

router.get('/dashboard',                    ctrl.getDashboardStats);

// Charts
router.get('/charts/weekly-visits',         ctrl.getWeeklyVisits);
router.get('/charts/monthly-appointments',  ctrl.getMonthlyAppointments);

// Next Appointments (today)
router.get('/appointments/next',            ctrl.getNextAppointments);

// Appointments
router.get('/appointments',                 ctrl.getAllAppointments);
router.put('/appointments/:id',             ctrl.updateAppointment);

// Doctors
router.get('/doctors',                      ctrl.getAllDoctors);
router.post('/doctors',                     ctrl.createDoctor);
router.patch('/doctors/:id/toggle',         ctrl.toggleDoctorStatus);

// Patients
router.get('/patients',                     ctrl.getAllPatients);
router.get('/patients/:id',                 ctrl.getPatientById);

// Remove doctor(s)
router.delete('/doctors/:id',              ctrl.removeDoctor);
router.delete('/doctors',                  ctrl.removeAllDoctors);

// Doctor schedules
router.get('/doctors/:id/schedule',        ctrl.getDoctorSchedule);
router.put('/doctors/:id/schedule',        ctrl.setDoctorSchedule);

module.exports = router;