import nodemailer from "nodemailer";

// Create a transporter with more reliable configuration
const createTransporter = () => {
  try {
    // Validate environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('EMAIL_USER and EMAIL_PASSWORD environment variables must be set');
    }

    console.log('Creating email transporter for:', process.env.EMAIL_USER);

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, // Use App Password here
      },
      tls: {
        rejectUnauthorized: false // Only for development/testing
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000, // 10 seconds
      socketTimeout: 10000, // 10 seconds
      pool: false // Disable pooling for server environments to avoid connection issues
    });
    
    return transporter;
  } catch (error) {
    console.error('Error creating email transporter:', error);
    throw error;
  }
};

// Generate a 6-character alphanumeric verification code (mix of numbers and letters)
export const generateVerificationCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

// Send verification email
export const sendVerificationEmail = async (email, code, name) => {
  let transporter;
  try {
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid email address format');
    }

    // Validate environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('Email service is not configured. Please set EMAIL_USER and EMAIL_PASSWORD environment variables.');
    }

    // Create and verify transporter
    transporter = createTransporter();
    
    // Verify connection before sending (with timeout)
    try {
      console.log('Verifying SMTP connection...');
      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SMTP verification timeout')), 10000)
        )
      ]);
      console.log('SMTP server connection verified');
    } catch (verifyError) {
      console.error('SMTP verification failed:', {
        message: verifyError.message,
        code: verifyError.code,
        command: verifyError.command,
        response: verifyError.response
      });
      // Don't throw here - try to send anyway as verify can fail but send might work
      console.warn('SMTP verification failed, but attempting to send email anyway...');
    }

    const mailOptions = {
      from: `"Workstream Automations" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Email Verification - Workstream Automations",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Workstream Automations, ${name}!</h2>
          <p style="color: #666; font-size: 16px;">Thank you for registering. Please verify your email address to complete your registration.</p>
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #333; font-size: 14px;">Your verification code is:</p>
            <h1 style="color: #4CAF50; font-size: 32px; margin: 10px 0; letter-spacing: 5px;">${code}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in 15 minutes.</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this verification, please ignore this email.</p>
        </div>
      `,
      // Add headers to prevent email clients from marking as spam
      headers: {
        'X-LAZINESS': 'none',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
      },
      // Add message configuration
      priority: 'high',
    };

    console.log('Sending verification email to:', email);
    
    // Send email with timeout
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
    );
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log('Email sent successfully:', info.messageId);
    
    return { 
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    const errorDetails = {
      message: error.message,
      code: error.code,
      response: error.response,
      command: error.command,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    
    console.error('Email sending failed:', JSON.stringify(errorDetails, null, 2));
    
    // More specific error handling
    let userMessage = 'Failed to send verification email';
    
    if (error.message && error.message.includes('Email service is not configured')) {
      userMessage = 'Email service is not configured. Please contact support.';
    } else if (error.message && error.message.includes('SMTP connection failed')) {
      userMessage = 'Could not connect to email server. Please check your email configuration.';
    } else if (error.code === 'EAUTH') {
      userMessage = 'Authentication failed. Please check your email credentials.';
    } else if (error.code === 'ECONNECTION') {
      userMessage = 'Could not connect to email server. Please check your internet connection.';
    } else if (error.code === 'EENVELOPE') {
      userMessage = 'Invalid email address or missing required fields.';
    } else if (error.code === 'ETIMEDOUT') {
      userMessage = 'Email server connection timed out. Please try again later.';
    }
    
    return { 
      success: false, 
      error: userMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
    };
  } finally {
    // Close the transporter connection for server environments
    // This helps avoid connection pool issues on servers
    if (transporter) {
      try {
        transporter.close();
      } catch (closeError) {
        console.warn('Error closing transporter:', closeError.message);
      }
    }
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (email, code, name) => {
  let transporter;
  try {
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid email address format');
    }

    // Validate environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('Email service is not configured. Please set EMAIL_USER and EMAIL_PASSWORD environment variables.');
    }

    // Create and verify transporter
    transporter = createTransporter();
    
    // Verify connection before sending (with timeout)
    try {
      console.log('Verifying SMTP connection for password reset...');
      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SMTP verification timeout')), 10000)
        )
      ]);
      console.log('SMTP server connection verified for password reset');
    } catch (verifyError) {
      console.error('SMTP verification failed:', {
        message: verifyError.message,
        code: verifyError.code,
        command: verifyError.command,
        response: verifyError.response
      });
      // Don't throw here - try to send anyway as verify can fail but send might work
      console.warn('SMTP verification failed, but attempting to send email anyway...');
    }

    const mailOptions = {
      from: `"Workstream Automations" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request - Workstream Automations",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p style="color: #666; font-size: 16px;">Hello ${name},</p>
          <p style="color: #666; font-size: 16px;">We received a request to reset your password. Use the code below to reset your password:</p>
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #333; font-size: 14px;">Your reset code is:</p>
            <h1 style="color: #4CAF50; font-size: 32px; margin: 10px 0; letter-spacing: 5px;">${code}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in 15 minutes.</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request a password reset, please ignore this email or contact support.</p>
        </div>
      `,
      headers: {
        'X-LAZINESS': 'none',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
      },
      priority: 'high',
    };

    console.log('Sending password reset email to:', email);
    
    // Send email with timeout
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
    );
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log('Password reset email sent successfully:', info.messageId);
    
    return { 
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    const errorDetails = {
      message: error.message,
      code: error.code,
      response: error.response,
      command: error.command,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    
    console.error('Password reset email failed:', JSON.stringify(errorDetails, null, 2));
    
    // More specific error handling
    let userMessage = 'Failed to send password reset email';
    
    if (error.message && error.message.includes('Email service is not configured')) {
      userMessage = 'Email service is not configured. Please contact support.';
    } else if (error.message && error.message.includes('SMTP connection failed')) {
      userMessage = 'Could not connect to email server. Please check your email configuration.';
    } else if (error.code === 'EAUTH') {
      userMessage = 'Authentication failed. Please check your email credentials.';
    } else if (error.code === 'ECONNECTION') {
      userMessage = 'Could not connect to email server. Please check your internet connection.';
    } else if (error.code === 'EENVELOPE') {
      userMessage = 'Invalid email address or missing required fields.';
    } else if (error.code === 'ETIMEDOUT') {
      userMessage = 'Email server connection timed out. Please try again later.';
    }
    
    return { 
      success: false, 
      error: userMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
    };
  } finally {
    // Close the transporter connection for server environments
    // This helps avoid connection pool issues on servers
    if (transporter) {
      try {
        transporter.close();
      } catch (closeError) {
        console.warn('Error closing transporter:', closeError.message);
      }
    }
  }
};

// Send appointment notification email
export const sendAppointmentNotification = async (appointment, recipientEmail, recipientName) => {
  try {
    const transporter = createTransporter();
    
    // Format date and time
    const formattedDate = new Date(appointment.scheduledDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedTime = new Date(appointment.scheduledDate).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: `New ${appointment.type} Scheduled - ${appointment.client.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #3b3da0e3; padding: 15px; text-align: center; color: white;">
            <h2 style="margin: 0; color: #ffffff;">Workstream Automations</h2>
          </div>
          
          <div style="padding: 20px;">
            <p style="font-size: 16px; color: #333;">Hello ${recipientName},</p>
            <p style="color: #555;">A new <strong>${appointment.type}</strong> has been scheduled.</p>

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Client:</strong> ${appointment.client.name}</p>
              <p><strong>Company:</strong> ${appointment.client.company || 'N/A'}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedTime}</p>
              ${appointment.notes ? `<p><strong>Notes:</strong> ${appointment.notes}</p>` : ''}
            </div>

            <p style="color: #666;">Best regards,<br>The Workstream Automations Team</p>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Workstream Automations. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending appointment notification:", error);
    return { success: false, error: error.message };
  }
};

// Send recording notification email
export const sendRecordingNotification = async (recording, recipientEmail, recipientName) => {
  try {
    const transporter = createTransporter();
    
    const formattedDate = new Date(recording.createdAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Format duration from seconds to MM:SS
    const formatDuration = (seconds) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: `New Recording: ${recording.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #3b3da0e3; padding: 15px; text-align: center; color: white;">
            <h2 style="margin: 0; color: #ffffff;">Workstream Automations</h2>
          </div>
          
          <div style="padding: 20px;">
            <p style="font-size: 16px; color: #333;">Hello ${recipientName},</p>
            <p style="color: #555;">A new recording has been uploaded.</p>

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Title:</strong> ${recording.title}</p>
              ${recording.description ? `<p><strong>Description:</strong> ${recording.description}</p>` : ""}
              <p><strong>Duration:</strong> ${formatDuration(recording.audio.duration)}</p>
              <p><strong>File Size:</strong> ${(recording.audio.fileSize / (1024 * 1024)).toFixed(2)} MB</p>
              <p><strong>Uploaded:</strong> ${formattedDate}</p>
              ${recording.clientName ? `<p><strong>Client:</strong> ${recording.clientName}</p>` : ""}
              ${recording.clientCompany ? `<p><strong>Company:</strong> ${recording.clientCompany}</p>` : ""}
            </div>

            <div style="margin: 25px 0; text-align: center;">
              <a href="${process.env.FRONTEND_URL || "https://your-app.com"}/recordings/${recording._id}" 
                style="background-color: #3b3da0ab; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Recording
              </a>
            </div>

            <p style="color: #666;">Best regards,<br>The Workstream Automations Team</p>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Workstream Automations. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending recording notification:", error);
    return { success: false, error: error.message };
  }
};