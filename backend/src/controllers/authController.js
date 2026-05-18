const User = require('../models/User');
const { signToken } = require('../utils/jwt');

function issueAuthResponse(user, res, statusCode = 200) {
  const token = signToken(user._id);
  return res.status(statusCode).json({
    success: true,
    token,
    user: user.toPublicJSON(),
  });
}

async function register(req, res, next) {
  try {
    const { name, email, password, role, institution, department } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role?.trim() || 'Student',
      institution: institution?.trim() || '',
      department: department?.trim() || '',
    });

    return issueAuthResponse(user, res, 201);
  } catch (err) {
    next(err);
  }
}

async function findUserWithPassword(email) {
  const normalized = email.trim().toLowerCase();
  let user = await User.findOne({ email: normalized }).select('+password');
  if (user?.password) return user;
  // Fallback for Mongoose 9 edge cases with select: false
  user = await User.findOne({ email: normalized }).select('password name email role institution department');
  return user;
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await findUserWithPassword(email);
    if (!user?.password) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const valid = await user.comparePassword(String(password));
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    return issueAuthResponse(user, res);
  } catch (err) {
    next(err);
  }
}

/** Set a new password (forgot-password flow; no email service yet) */
async function resetPassword(req, res, next) {
  try {
    const { email, newPassword } = req.body;

    if (!email?.trim() || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email and new password are required' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const user = await findUserWithPassword(email);
    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found with this email' });
    }

    user.password = String(newPassword);
    await user.save();

    return issueAuthResponse(user, res);
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res) {
  res.json({ success: true, user: req.user.toPublicJSON() });
}

async function updateMe(req, res, next) {
  try {
    const { name, role, institution, department } = req.body;
    const user = req.user;

    if (name !== undefined) user.name = String(name).trim();
    if (role !== undefined) user.role = String(role).trim();
    if (institution !== undefined) user.institution = String(institution).trim();
    if (department !== undefined) user.department = String(department).trim();

    if (!user.name) {
      return res.status(400).json({ success: false, error: 'Name cannot be empty' });
    }

    await user.save();
    res.json({ success: true, user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe, updateMe, resetPassword };
