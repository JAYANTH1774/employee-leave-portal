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
const MONGO_URI = process.env.MONGO_URI;
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

// API Endpoints
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, JWT_SECRET);
  res.json({ token, user });
});

app.get('/api/users', async (req, res) => res.json(await User.find()));
app.get('/api/attendance', async (req, res) => res.json(await Attendance.find().populate('user').sort({ _id: -1 })));

app.post('/api/attendance/checkin', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const user = await User.findOne({ role: 'Admin' });
  const rec = await Attendance.create({ user: user._id, date: today, checkIn: new Date().toLocaleTimeString(), status: 'Present' });
  res.json(rec);
});

app.post('/api/attendance/checkout', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const rec = await Attendance.findOne({ date: today }).sort({ _id: -1 });
  if (rec) {
    rec.checkOut = new Date().toLocaleTimeString();
    await rec.save();
  }
  res.json(rec || {});
});

app.get('/api/leaves', async (req, res) => res.json(await LeaveRequest.find().populate('user').sort({ _id: -1 })));

app.post('/api/leaves/apply', async (req, res) => {
  const user = await User.findOne({ role: 'Admin' });
  const leave = await LeaveRequest.create({ ...req.body, user: user._id });
  res.json(leave);
});

app.patch('/api/leaves/:id', async (req, res) => {
  const leave = await LeaveRequest.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  res.json(leave);
});

app.get('/api/shifts', async (req, res) => res.json(await Shift.find().populate('user')));
app.get('/api/holidays', async (req, res) => res.json(await Holiday.find()));

// Reports Endpoint (4 Mandatory Reports)
app.get('/api/reports', async (req, res) => {
  res.json({
    attendanceSummary: await Attendance.find().populate('user'),
    leaveBalances: await User.find(),
    shiftRoster: await Shift.find().populate('user'),
    absenteeism: await LeaveRequest.find({ status: 'Approved' }).populate('user')
  });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database connection & auto-seed
mongoose.connect(MONGO_URI).then(async () => {
  console.log('MongoDB Connected Successfully');
  if (await User.countDocuments() === 0) {
    const pw = await bcrypt.hash('admin123', 10);
    const admin = await User.create({ name: 'Nimishakavi Jayanth', email: 'admin@elass.com', password: pw, role: 'Admin', department: 'Management' });
    const hr = await User.create({ name: 'Sarah HR', email: 'hr@elass.com', password: pw, role: 'HR Manager', department: 'Human Resources' });
    const mgr = await User.create({ name: 'Vikram Manager', email: 'manager@elass.com', password: pw, role: 'Team Manager', department: 'Engineering' });
    const emp = await User.create({ name: 'Sai Krishna', email: 'employee@elass.com', password: pw, role: 'Employee', department: 'Engineering' });

    await Holiday.create([
      { title: 'Republic Day', date: '2026-01-26', type: 'Mandatory' },
      { title: 'Independence Day', date: '2026-08-15', type: 'Mandatory' },
      { title: 'Diwali', date: '2026-11-08', type: 'Mandatory' }
    ]);

    await Shift.create([
      { user: admin._id, shiftName: 'General (09:00 - 18:00)', date: '2026-11-21' },
      { user: emp._id, shiftName: 'Morning (06:00 - 14:00)', date: '2026-11-21' }
    ]);

    await Attendance.create({ user: admin._id, date: '2026-11-21', checkIn: '09:00 AM', checkOut: '06:00 PM', status: 'Present' });
    await LeaveRequest.create({ user: emp._id, leaveType: 'casual', startDate: '2026-11-25', endDate: '2026-11-26', days: 2, reason: 'Personal errand', status: 'Approved' });
  }
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => console.error(err));
