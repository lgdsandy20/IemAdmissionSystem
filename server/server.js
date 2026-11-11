import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdirSync, unlink } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAX_UPLOAD_BYTES, validateMarks, canTransition, canApprove, validateDocumentDecision, validUploadMetadata } from './pocRules.js';

// Respect the host DNS settings for MongoDB Atlas.

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'uploads');
mkdirSync(uploadsDir, { recursive: true });

// ---------- Models ----------
const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  passwordHash: String,
  role: { type: String, enum: ['applicant', 'officer', 'admin'], default: 'applicant' },
}));

const Application = mongoose.model('Application', new mongoose.Schema({
  appId: { type: String, unique: true, required: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true }, // FR-8: one per applicant
  applicantName: String,
  course: String,
  campus: String,
  qualification: String,
  marks: Number,
  docs: [{
    label: String,
    fileName: String,
    mimeType: String,
    status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
    reason: String,
  }],
  feeStatus: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
  status: { type: String, enum: ['Submitted', 'Under Review', 'Approved', 'Rejected'], default: 'Submitted' },
  history: [{ status: String, at: Date, by: String }],
}, { timestamps: true }));

// ---------- Helpers ----------
// Admission business rules are implemented and tested in pocRules.js.
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter(req, file, cb) {
    if (validUploadMetadata(file)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG / PNG / PDF files allowed'));
    }
  },
});

function sign(user) {
  return jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '15m' }); // FR-25
}

function auth(roles) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '');
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Not logged in' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function notify(app_, text) {
  console.log(`[sandbox email] to applicant of ${app_.appId}: ${text}`);
}

// ---------- Auth ----------
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Name, email and 8+ char password required' });
  }
  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role: 'applicant' });
  res.json({ token: sign(user), role: user.role });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: sign(user), role: user.role });
}));

// ---------- Applicant ----------
app.get('/api/applications/mine', auth(['applicant']), asyncRoute(async (req, res) => {
  const doc = await Application.findOne({ applicant: req.user.id });
  res.json(doc); // null if none yet
}));

app.post('/api/applications', auth(['applicant']), asyncRoute(async (req, res) => {
  const { course, campus, qualification, marks } = req.body;
  if (typeof course !== 'string' || !course.trim() || typeof campus !== 'string' || !campus.trim())
    return res.status(400).json({ error: 'Course and campus required' });
  const checked = validateMarks(marks);
  if (!checked.ok) return res.status(checked.status).json({ error: checked.error });
  const pct = checked.marks;
  const existing = await Application.findOne({ applicant: req.user.id });
  if (existing) {
    return res.status(409).json({ error: 'Already submitted' });
  }
  // UUID avoids collisions between concurrent applications.
  const appId = 'APP-' + new Date().getFullYear() + '-' + randomUUID();
  const created = await Application.create({
    appId, applicant: req.user.id, applicantName: req.user.name,
    course, campus, qualification, marks: pct,
    docs: [{ label: 'Mark sheet' }, { label: 'ID proof' }, { label: 'Photo' }],
    history: [{ status: 'Submitted', at: new Date(), by: req.user.name }],
  });
  res.json(created);
}));

// Authorize before Multer stores the uploaded bytes, to prevent orphan files.
async function checkUploadOwner(req,res,next) {
  try {
    const appDoc = await Application.findOne({appId:req.params.id,applicant:req.user.id});
    if (!appDoc) return res.status(404).json({error:'Application not found'});
    if (['Approved','Rejected'].includes(appDoc.status))
      return res.status(409).json({error:'Cannot change a final application'});
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= appDoc.docs.length)
      return res.status(400).json({error:'Bad document slot'});
    req.appDoc = appDoc;
    req.slotIndex = index;
    next();
  } catch(error) {next(error)}
}
app.post('/api/applications/:id/docs/:index', auth(['applicant']), checkUploadOwner, upload.single('file'), asyncRoute(async (req, res) => {
  const doc = await Application.findOne({ appId: req.params.id, applicant: req.user.id });
  if (!doc) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (!req.file) return res.status(400).json({ error: 'File required' });
  const slot = doc.docs[req.slotIndex];
  const oldFileName = slot.fileName;
  slot.fileName = req.file.filename;
  slot.mimeType = req.file.mimetype;
  slot.status = 'Pending'; // re-upload after rejection resets it (FR-16)
  slot.reason = '';
  await doc.save();
  if (oldFileName && oldFileName !== slot.fileName) unlink(path.join(uploadsDir, path.basename(oldFileName)), () => {});
  res.json(doc);
}));

app.post('/api/applications/:id/pay', auth(['applicant']), asyncRoute(async (req, res) => {
  const doc = await Application.findOne({ appId: req.params.id, applicant: req.user.id });
  if (!doc) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (['Approved', 'Rejected'].includes(doc.status))
    return res.status(409).json({ error: 'Cannot change a final application' });
  doc.feeStatus = 'Paid'; // Demo only; no real payment is processed.
  await doc.save();
  res.json(doc);
}));

// ---------- Officer ----------
const staff = auth(['officer', 'admin']);

app.get('/api/officer/applications', staff, asyncRoute(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const list = await Application.find({ $or: [{ appId: rx }, { applicantName: rx }, { course: rx }] });
  res.json(list);
}));

app.patch('/api/officer/applications/:id/docs/:index', staff, asyncRoute(async (req, res) => {
  const { status, reason } = req.body || {};
  const checked = validateDocumentDecision(status, reason);
  if (!checked.ok) return res.status(checked.status).json({ error: checked.error });
  const doc = await Application.findOne({ appId: req.params.id });
  if (!doc) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (['Approved', 'Rejected'].includes(doc.status))
    return res.status(409).json({ error: 'Cannot change a final application' });
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= doc.docs.length)
    return res.status(400).json({ error: 'Bad document slot' });
  const slot = doc.docs[index];
  if (!slot.fileName) return res.status(422).json({ error: 'Upload the document before verifying' });
  if (doc.status === 'Submitted') {
    // A staff verification begins the Under Review phase.
    doc.status = 'Under Review';
    doc.history.push({ status: 'Under Review', at: new Date(), by: req.user.name });
  }
  slot.status = status;
  slot.reason = status === 'Rejected' ? reason.trim() : '';
  if (status === 'Rejected') {
    notify(doc, `document "${slot.label}" rejected: ${reason}`); // FR-15
  }
  await doc.save();
  res.json(doc);
}));

app.patch('/api/officer/applications/:id/decision', staff, asyncRoute(async (req, res) => {
  const { decision } = req.body; // 'Approved' | 'Rejected'
  const doc = await Application.findOne({ appId: req.params.id });
  if (!doc) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (decision !== 'Approved' && decision !== 'Rejected')
    return res.status(400).json({ error: 'Invalid decision' });
  if (!canTransition(doc.status, decision))
    return res.status(409).json({ error: 'Invalid status transition' });
  if (decision === 'Approved' && !canApprove(doc))
    return res.status(422).json({ error: 'Verify all documents and fee before approving' });
  doc.status = decision;
  doc.history.push({ status: decision, at: new Date(), by: req.user.name });
  await doc.save();
  notify(doc, `your application was ${decision.toLowerCase()}`); // FR-30
  res.json(doc);
}));

app.get('/api/officer/files/:name', staff, asyncRoute(async (req, res) => {
  if (!/^[a-z0-9_-]+$/i.test(req.params.name))
    return res.status(400).json({ error: 'Invalid filename' });
  const found = await Application.findOne({ 'docs.fileName': req.params.name });
  if (!found) {
    return res.status(404).json({ error: 'File not found' });
  }
  const slot = found.docs.find(d => d.fileName === req.params.name);
  res.type(slot.mimeType || 'application/octet-stream');
  res.sendFile(path.join(uploadsDir, path.basename(req.params.name)));
}));

// Convert upload and database failures into predictable JSON responses.
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({error:'File exceeds 5 MB limit'});
  if (error.code === 11000) return res.status(409).json({error:'Duplicate account or application'});
  if (error.message === 'Only JPEG / PNG / PDF files allowed')
    return res.status(400).json({error:error.message});
  console.error('API error:', error);
  res.status(500).json({error:'Unexpected server error'});
});

// ---------- Boot ----------
if (!process.env.MONGO_URI || !process.env.JWT_SECRET)
  throw new Error('Configure MONGO_URI and JWT_SECRET privately');
await mongoose.connect(process.env.MONGO_URI);
if (process.env.SEED_DEMO_OFFICER === 'true') {
  // Create a demo officer only when explicitly requested; never hard-code the password.
  const email = process.env.DEMO_OFFICER_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_OFFICER_PASSWORD;
  if (!email || !password || password.length < 8) throw new Error('Set demo officer email and password in .env');
  if (!(await User.findOne({email})))
    await User.create({name:'Test Officer',email,passwordHash:await bcrypt.hash(password,10),role:'officer'});
}
app.listen(process.env.PORT || 5000, () => console.log('API on :' + (process.env.PORT || 5000)));
