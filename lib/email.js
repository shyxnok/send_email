const nodemailer = require('nodemailer');

async function sendEmail({ serverAddress, serverPort, username, password,
                           subject, body, to, from, isHtml }) {
  const transporter = nodemailer.createTransport({
    host: serverAddress,
    port: serverPort,
    secure: serverPort === 465,
    auth: { user: username, pass: password },
  });

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    [isHtml ? 'html' : 'text']: body,
  });

  return { messageId: info.messageId };
}

module.exports = { sendEmail };
