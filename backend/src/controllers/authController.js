const crypto = require('crypto');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const { sendOtpEmail } = require('../utils/email');

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

/** Change password for an authenticated user requiring their current password */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const valid = await user.comparePassword(String(currentPassword));
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    user.password = String(newPassword);
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
}

/** Step 1 of Forgot Password: Request a 6-digit OTP sent via Email */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Always respond with success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a verification code has been sent.',
      });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    user.resetOtp = hashedOtp;
    user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    await sendOtpEmail(normalizedEmail, otp);

    return res.json({
      success: true,
      message: 'If an account exists with this email, a verification code has been sent.',
    });
  } catch (err) {
    next(err);
  }
}

/** Step 2 of Forgot Password: Verify the 6-digit OTP and return a reset token */
async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;

    if (!email?.trim() || !otp?.trim()) {
      return res.status(400).json({ success: false, error: 'Email and OTP code are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+resetOtp +resetOtpExpires');

    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code' });
    }

    if (Date.now() > new Date(user.resetOtpExpires).getTime()) {
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
    }

    const hashedOtp = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (hashedOtp !== user.resetOtp) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    // OTP is valid — generate single-use reset token valid for 15 minutes
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    user.resetToken = hashedToken;
    user.resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    return res.json({
      success: true,
      resetToken,
      message: 'Verification successful',
    });
  } catch (err) {
    next(err);
  }
}

/** Step 3 of Forgot Password: Reset Password using the verified Reset Token */
async function resetPassword(req, res, next) {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!email?.trim() || !resetToken?.trim() || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, reset token, and new password are required' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hashedToken = crypto.createHash('sha256').update(resetToken.trim()).digest('hex');

    const user = await User.findOne({
      email: normalizedEmail,
      resetToken: hashedToken,
      resetTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset session. Please request a new verification code.',
      });
    }

    user.password = String(newPassword);
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
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

/** Reset password using email & current password */
async function resetWithCurrentPassword(req, res, next) {
  try {
    const { email, currentPassword, newPassword } = req.body;

    if (!email?.trim() || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, current password, and new password are required' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    }

    const user = await findUserWithPassword(email);
    if (!user?.password) {
      return res.status(401).json({ success: false, error: 'Invalid email or current password' });
    }

    const valid = await user.comparePassword(String(currentPassword));
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    user.password = String(newPassword);
    await user.save();

    return issueAuthResponse(user, res);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  resetWithCurrentPassword,
  forgotPassword,
  verifyOtp,
  resetPassword,
};
