const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { saveImage } = require('../services/storage');
const { sendMail } = require('../services/mailer');
const { HttpError } = require('../utils/http');

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Comma-separated list, e.g. "college.edu.in,staff.college.edu.in". Empty = any.
const allowedDomains = () => (process.env.ALLOWED_EMAIL_DOMAINS || '')
  .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

// ─── Register ─────────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password, studentId, department, role } = req.body;
    if (!email || !password || !name) throw new HttpError(400, 'Name, email and password are required');

    const domains = allowedDomains();
    const domain = String(email).split('@')[1]?.toLowerCase();
    if (domains.length && !domains.includes(domain)) {
      throw new HttpError(400, `Please use your institutional email (${domains.map((d) => '@' + d).join(', ')})`);
    }

    // Admin accounts can only be created by seeding or an existing admin.
    const assignedRole = ['student', 'faculty', 'staff'].includes(role) ? role : 'student';

    if (await User.exists({ email: String(email).toLowerCase() })) {
      throw new HttpError(409, 'Email already registered');
    }

    const user = await User.create({ name, email, password, studentId, department, role: assignedRole });
    res.status(201).json({ success: true, token: signToken(user._id), user: user.toSelfJSON() });
  } catch (err) {
    if (err.code === 11000) return next(new HttpError(409, 'Email already registered'));
    next(err);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new HttpError(400, 'Email and password required');

    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      throw new HttpError(401, 'Invalid email or password');
    }
    if (!user.isActive) throw new HttpError(403, 'This account has been deactivated');

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, token: signToken(user._id), user: user.toSelfJSON() });
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res) => {
  res.json({ success: true, user: req.user.toSelfJSON() });
};

// ─── Forgot / reset password ──────────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const generic = { success: true, message: 'If that email is registered, a reset link has been sent.' };
    const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
    if (!user) return res.json(generic); // don't reveal which emails exist

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const link = `${clientUrl}/reset-password/${resetToken}`;
    const sent = await sendMail({
      to: user.email,
      subject: 'Reset your FindIt password',
      text: `Hi ${user.name},\n\nUse this link within one hour to choose a new password:\n${link}\n\nIf you did not ask for this, ignore this email.`,
    });

    // Without SMTP configured, development mode hands the link back directly so
    // the flow can still be demonstrated. Never in production.
    if (!sent && process.env.NODE_ENV !== 'production') {
      console.log(`Password reset link for ${user.email}: ${link}`);
      return res.json({ ...generic, devResetUrl: `/reset-password/${resetToken}` });
    }
    res.json(generic);
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');

    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });
    if (!user) throw new HttpError(400, 'This reset link is invalid or has expired');

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    res.json({ success: true, message: 'Password updated', token: signToken(user._id), user: user.toSelfJSON() });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) throw new HttpError(400, 'New password must be at least 8 characters');
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword || ''))) throw new HttpError(400, 'Current password is incorrect');
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed' });
  } catch (err) {
    next(err);
  }
};

// ─── Update profile ───────────────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'studentId', 'department', 'phone'];
    const updates = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (req.body.notificationPreferences !== undefined) {
      const prefs = typeof req.body.notificationPreferences === 'string'
        ? JSON.parse(req.body.notificationPreferences)
        : req.body.notificationPreferences;
      updates.notificationPreferences = { email: Boolean(prefs.email), inApp: Boolean(prefs.inApp) };
    }
    if (req.file) {
      const saved = await saveImage(req.file.buffer, { folder: 'avatars', mimetype: req.file.mimetype });
      updates.avatar = saved.url;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, user: user.toSelfJSON() });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, forgotPassword, resetPassword, changePassword, updateProfile };
