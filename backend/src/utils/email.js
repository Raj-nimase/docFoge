const nodemailer = require('nodemailer');

/**
 * Send Password Reset OTP Email
 * @param {string} toEmail
 * @param {string} otp
 */
async function sendOtpEmail(toEmail, otp) {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const rawUser = process.env.SMTP_USER || '';
  const rawPass = process.env.SMTP_PASS || '';

  // Clean quotes and spaces from environment variables
  const user = rawUser.replace(/["']/g, '').trim();
  const pass = rawPass.replace(/["']/g, '').replace(/\s+/g, '');

  // Fallback to console output if SMTP credentials are not set (for local dev / testing)
  if (!user || !pass) {
    console.log(`\n=================================================`);
    console.log(`[EMAIL SIMULATOR] Password Reset OTP for ${toEmail}:`);
    console.log(`🔑  OTP CODE: [ ${otp} ] (Valid for 10 minutes)`);
    console.log(`=================================================\n`);
    return { success: true, simulated: true };
  }

  try {
    let transporter;
    if (host.includes('gmail')) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    } else {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }

    const mailOptions = {
      from: `"AcaDoc Support" <${process.env.SMTP_FROM || user}>`,
      to: toEmail,
      subject: 'AcaDoc - Your Password Reset Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #4f46e5; text-align: center;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>You requested to reset your password for your <strong>AcaDoc</strong> account. Use the verification code below to proceed:</p>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #1f2937; border-radius: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="font-size: 13px; color: #6b7280;">This code is valid for <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 11px; color: #9ca3af; text-align: center;">AcaDoc Academic Document Platform</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[sendOtpEmail] Email sent to ${toEmail}: messageId=${info.messageId}`);
    return { success: true, sent: true };
  } catch (err) {
    console.error(`[sendOtpEmail] Failed to send email via SMTP:`, err.message || err);
    // Fallback: log to console so development is never blocked
    console.log(`\n=================================================`);
    console.log(`[EMAIL FALLBACK] Password Reset OTP for ${toEmail}:`);
    console.log(`🔑  OTP CODE: [ ${otp} ] (Valid for 10 minutes)`);
    console.log(`=================================================\n`);
    return { success: true, fallback: true };
  }
}

module.exports = { sendOtpEmail };
