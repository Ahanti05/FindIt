const nodemailer = require('nodemailer');

const isConfigured = Boolean(
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS &&
  process.env.EMAIL_USER !== 'your_email@gmail.com'
);

const transporter = isConfigured
  ? nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  })
  : null;

// Returns true when an email was actually sent.
const sendMail = async ({ to, subject, text }) => {
  if (!transporter) return false;
  await transporter.sendMail({ from: process.env.EMAIL_FROM || process.env.EMAIL_USER, to, subject, text });
  return true;
};

module.exports = { sendMail, isMailConfigured: isConfigured };
