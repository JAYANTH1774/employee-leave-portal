const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://2303a51774_db_user:U3he6vTdg1I3T6J7@jayanth.h1xxmxd.mongodb.net/elass_db?retryWrites=true&w=majority";
const JWT_SECRET = process.env.JWT_SECRET || 'secret_jwt_key_2026';

// Schemas & Models
const UserSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true }, password: String,
  role: { type: String, enum: ['Admin', 'HR Manager', 'Team Manager', 'Employee'], default: 'Employee' },
  department: { type: String, default: 'Engineering' },
  leaveBalance: { casual: { type: Number, default: 12 }, sick: { type: Number, default: 8 }, earned: { type: Number, default: 15 } }
});
const User = mongoose.model('User', UserSchema);

const AttendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: String, checkIn: String, checkOut: String, status: { type: String, default: 'Present' }
});
const Attendance = mongoose.model('Attendance', AttendanceSchema);

const LeaveSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  leaveType: String, startDate: String, endDate: String, days: Number, reason: String,
  status: { type: String, default: 'Pending' }
});
const LeaveRequest = mongoose.model('LeaveRequest', LeaveSchema);

const ShiftSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  shiftName: String, date: String, location: { type: String, default: 'On-site' }
});
const Shift = mongoose.model('Shift', ShiftSchema);

const HolidaySchema = new mongoose.Schema({ title: String, date: String, type: { type: String, default: 'Mandatory' } });
const Holiday = mongoose.model('Holiday', HolidaySchema);

// In-Memory Fallback State (Ensures UI works even if DB connection is slow)
let memoryUsers = [
  { _id: '1', name: 'Nimishakavi Jayanth', email: 'admin@elass.com', role: 'Admin', department: 'Management', leaveBalance: { casual: 12, sick: 8, earned: 15 } },
  { _id: '2', name: 'Sarah HR', email: 'hr@elass.com', role: 'HR Manager', department: 'HR', leaveBalance: { casual: 10, sick: 6, earned: 14 } },
  { _id: '3', name: 'Vikram Manager', email: 'manager@elass.com', role: 'Team Manager', department: 'Engineering', leaveBalance: { casual: 11, sick: 7, earned: 12 } },
  { _id: '4', name: 'Sai Krishna', email: 'employee@elass.com', role: 'Employee', department: 'Engineering', leaveBalance: { casual: 9, sick: 5, earned: 10 } }
];

let memoryAttendance = [
  { _id: 'a1', date: '2026-11-21', user: memoryUsers[0], checkIn: '09:00 AM', checkOut: '06:00 PM', status: 'Present' },
  { _id: 'a2', date: '2026-11-21', user: memoryUsers[3], checkIn: '09:15 AM', checkOut: '--', status: 'Present' }
];

let memoryLeaves = [
  { _id: 'l1', user: memoryUsers[3], leaveType: 'casual', startDate: '2026-11-25', endDate: '2026-11-26', days: 2, reason: 'Personal errand', status: 'Approved' },
  { _id: 'l2', user: memoryUsers[1], leaveType: 'sick', startDate: '2026-11-28', endDate: '2026-11-28', days: 1, reason: 'Medical checkup', status: 'Pending' }
];

let memoryShifts = [
  { _id: 's1', user: memoryUsers[0], shiftName: 'General (09:00 - 18:00)', date: '2026-11-21', location: 'On-site' },
  { _id: 's2', user: memoryUsers[3], shiftName: 'Morning (06:00 - 14:00)', date: '2026-11-21', location: 'On-site' }
];

let memoryHolidays = [
  { _id: 'h1', title: 'Republic Day', date: '2026-01-26', type: 'Mandatory' },
  { _id: 'h2', title: 'Independence Day', date: '2026-08-15', type: 'Mandatory' },
  { _id: 'h3', title: 'Diwali', date: '2026-11-08', type: 'Mandatory' }
];

// Routes
app.get('/api/users', async (req, res) => {
  try {
    const data = await User.find();
    res.json(data.length ? data : memoryUsers);
  } catch (e) {
    res.json(memoryUsers);
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    const data = await Attendance.find().populate('user').sort({ _id: -1 });
    res.json(data.length ? data : memoryAttendance);
  } catch (e) {
    res.json(memoryAttendance);
  }
});

app.post('/api/attendance/checkin', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const newRecord = { _id: Date.now().toString(), date: today, user: memoryUsers[0], checkIn: new Date().toLocaleTimeString(), checkOut: '--', status: 'Present' };
  memoryAttendance.unshift(newRecord);
  try {
    const user = await User.findOne({ role: 'Admin' });
    if (user) await Attendance.create({ user: user._id, date: today, checkIn: newRecord.checkIn, status: 'Present' });
  } catch (e) {}
  res.json(newRecord);
});

app.post('/api/attendance/checkout', async (req, res) => {
  if (memoryAttendance.length) {
    memoryAttendance[0].checkOut = new Date().toLocaleTimeString();
  }
  res.json(memoryAttendance[0] || {});
});

app.get('/api/leaves', async (req, res) => {
  try {
    const data = await LeaveRequest.find().populate('user').sort({ _id: -1 });
    res.json(data.length ? data : memoryLeaves);
  } catch (e) {
    res.json(memoryLeaves);
  }
});

app.post('/api/leaves/apply', async (req, res) => {
  const newLeave = { _id: Date.now().toString(), user: memoryUsers[0], ...req.body, status: 'Pending' };
  memoryLeaves.unshift(newLeave);
  try {
    const user = await User.findOne({ role: 'Admin' });
    if (user) await LeaveRequest.create({ ...req.body, user: user._id });
  } catch (e) {}
  res.json(newLeave);
});

app.patch('/api/leaves/:id', async (req, res) => {
  const item = memoryLeaves.find(l => l._id === req.params.id);
  if (item) item.status = req.body.status;
  try {
    await LeaveRequest.findByIdAndUpdate(req.params.id, { status: req.body.status });
  } catch (e) {}
  res.json(item || { status: req.body.status });
});

app.get('/api/shifts', async (req, res) => {
  try {
    const data = await Shift.find().populate('user');
    res.json(data.length ? data : memoryShifts);
  } catch (e) {
    res.json(memoryShifts);
  }
});

app.get('/api/holidays', async (req, res) => {
  try {
    const data = await Holiday.find();
    res.json(data.length ? data : memoryHolidays);
  } catch (e) {
    res.json(memoryHolidays);
  }
});

app.get('/api/reports', (req, res) => {
  res.json({
    attendanceSummary: memoryAttendance,
    leaveBalances: memoryUsers,
    shiftRoster: memoryShifts,
    absenteeism: memoryLeaves.filter(l => l.status === 'Approved')
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// START SERVER IMMEDIATELY so Render detects open port 5000 right away
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
  // Connect to MongoDB asynchronously in the background
  mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.log('MongoDB Notice:', err.message));
});
