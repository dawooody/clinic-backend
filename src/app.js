require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const patientRoutes = require('./modules/patients/patients.routes');
const doctorRoutes = require('./modules/doctors/doctors.routes');
const appointmentRoutes = require('./modules/appointments/appointments.routes');
const recordRoutes = require('./modules/medical-records/records.routes');
const prescriptionRoutes = require('./modules/prescriptions/prescriptions.routes');
const trackerRoutes = require('./modules/symptom-tracker/tracker.routes');
const familyRoutes = require('./modules/family-links/family.routes');
const aiRoutes = require('./modules/ai/ai.routes');
const adminRoutes      = require('./modules/admin/admin.routes');
const specialtyRoutes      = require('./modules/specialties/specialties.routes');
const notificationRoutes   = require('./modules/notifications/notifications.routes');

const app = express();

// ─── Security & Middleware ──────────────────────────────────────────────────
app.use(helmet());

// CORS - allow mobile app (Flutter) to connect from any origin
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Serve uploaded files (lab reports, profile photos, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Smart Clinic API is running 🏥' });
});

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/medical-records', recordRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/symptom-tracker', trackerRoutes);
app.use('/api/symptoms', trackerRoutes);
app.use('/api/family-links', familyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/specialties',    specialtyRoutes);
app.use('/api/notifications',  notificationRoutes);

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
