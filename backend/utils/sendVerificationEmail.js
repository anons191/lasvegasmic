const nodemailer = require('nodemailer');

/**
 * Send a verification email to the user
 * @param {string} email - User's email address
 * @param {string} token - Verification token
 * @returns {Promise} - Resolves when email is sent
 */
const sendVerificationEmail = async (email, token) => {
  try {
    // Create a transporter using SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Construct verification URL
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    console.log('Constructed verification URL:', verificationUrl);

    // Email options
    const mailOptions = {
      from: `"Las Vegas Mic" <${process.env.EMAIL_USERNAME}>`,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Welcome to Las Vegas Mic!</h2>
          <p>Thank you for registering. Please verify your email address to continue:</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
          </div>
          <p>If the button above doesn't work, you can also click on the link below or copy and paste it into your browser:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="font-size: 12px; color: #777; text-align: center;">Las Vegas Mic - Connect with comedians and venues in Las Vegas</p>
        </div>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent to:', email);
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    throw error;
  }
};

module.exports = sendVerificationEmail;
