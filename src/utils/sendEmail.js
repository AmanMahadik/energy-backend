const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // or use your service
    auth: {
      user: 'your_email@gmail.com',
      pass: 'your_app_password'  // Use App Password
    }
  });

  await transporter.sendMail({
    from: '"Energy App" <your_email@gmail.com>',
    to,
    subject,
    text,
  });
};

module.exports = sendEmail;
