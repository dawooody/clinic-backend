const axios = require('axios');

const sendEmail = async (to, subject, html) => {
  try {
    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: 'clinicsync',
          email: 'simmabibo113@gmail.com'
        },
        to: [
          {
            email: to
          }
        ],
        subject,
        htmlContent: html
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Email sent');

  } catch (err) {
    console.error(
      err.response?.data || err.message
    );
    throw new Error('Failed to send email');
  }
};

module.exports = sendEmail;