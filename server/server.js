// server/server.js
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

connectDB();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Serve uploaded files (contracts, IDs, certificates, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'Rekker HR API' }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/leave', require('./routes/leaveRoutes'));
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/performance', require('./routes/performanceRoutes'));
app.use('/api/recruitment', require('./routes/recruitmentRoutes'));
app.use('/api/onboarding', require('./routes/onboardingRoutes'));
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/training', require('./routes/trainingRoutes'));
app.use('/api/disciplinary', require('./routes/disciplinaryRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Rekker HR API running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
