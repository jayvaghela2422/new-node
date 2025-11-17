import nodemailer from "nodemailer";

// Create a transporter with more reliable configuration
// Tries port 587 first, falls back to 465 if needed
// Can be forced to use a specific port via EMAIL_PORT environment variable
const createTransporter = (usePort465 = false) => {
  try {
    // Validate environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('EMAIL_USER and EMAIL_PASSWORD environment variables must be set');
    }

    // Allow forcing a specific port via environment variable
    let port, secure;
    if (process.env.EMAIL_PORT) {
      port = parseInt(process.env.EMAIL_PORT);
      secure = port === 465;
      console.log(`Using forced port from EMAIL_PORT environment variable: ${port}`);
    } else {
      port = usePort465 ? 465 : 587;
      secure = usePort465;
    }
    
    console.log(`Creating email transporter for: ${process.env.EMAIL_USER} on port ${port} (secure: ${secure})`);

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: port,
      secure: secure, // true for 465, false for 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, // Use App Password here
      },
      tls: {
        rejectUnauthorized: false // Only for development/testing
      },
      connectionTimeout: 20000, // 20 seconds for server environments
      greetingTimeout: 20000, // 20 seconds
      socketTimeout: 20000, // 20 seconds
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

    // Create and verify transporter - try port 587 first, fallback to 465
    // Skip fallback if EMAIL_PORT is explicitly set
    let connectionFailed = false;
    let lastError = null;
    const useForcedPort = !!process.env.EMAIL_PORT;
    
    // Try port 587 first (or forced port)
    try {
      transporter = createTransporter(false);
      console.log(`Attempting connection on port ${transporter.options.port}...`);
      
      // Verify connection with timeout
      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SMTP verification timeout')), 15000)
        )
      ]);
      console.log(`SMTP server connection verified on port ${transporter.options.port}`);
    } catch (verifyError) {
      console.warn(`Port ${transporter?.options?.port || 587} connection failed:`, verifyError.message);
      lastError = verifyError;
      connectionFailed = true;
      
      // Try port 465 as fallback only if EMAIL_PORT is not set
      if (!useForcedPort) {
        try {
          console.log('Attempting fallback connection on port 465...');
          transporter = createTransporter(true);
          
          await Promise.race([
            transporter.verify(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('SMTP verification timeout')), 15000)
            )
          ]);
          console.log('SMTP server connection verified on port 465');
          connectionFailed = false;
        } catch (fallbackError) {
          console.error('Port 465 connection also failed:', fallbackError.message);
          lastError = fallbackError;
          // Don't throw here - try to send anyway as verify can fail but send might work
          console.warn('SMTP verification failed on both ports, but attempting to send email anyway...');
        }
      } else {
        console.warn('Using forced port, skipping fallback. Attempting to send email anyway...');
      }
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
    
    // Send email with timeout - try sending, if fails try alternative port
    let sendSuccess = false;
    let sendError = null;
    
    try {
      const sendPromise = transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
      );
      
      const info = await Promise.race([sendPromise, timeoutPromise]);
      console.log('Email sent successfully:', info.messageId);
      sendSuccess = true;
      return { 
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (sendErr) {
      sendError = sendErr;
      console.error('Email send failed on current port:', sendErr.message);
      
      // If we haven't tried port 465 yet and EMAIL_PORT is not set, try it now
      if ((!connectionFailed || !transporter || transporter.options.port === 587) && !process.env.EMAIL_PORT) {
        try {
          console.log('Retrying email send on port 465...');
          transporter = createTransporter(true);
          
          const sendPromise = transporter.sendMail(mailOptions);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
          );
          
          const info = await Promise.race([sendPromise, timeoutPromise]);
          console.log('Email sent successfully on port 465:', info.messageId);
          return { 
            success: true,
            messageId: info.messageId,
            response: info.response
          };
        } catch (retryErr) {
          console.error('Email send also failed on port 465:', retryErr.message);
          throw sendErr; // Throw original error
        }
      } else {
        throw sendErr;
      }
    }
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

    // Create and verify transporter - try port 587 first, fallback to 465
    // Skip fallback if EMAIL_PORT is explicitly set
    let connectionFailed = false;
    let lastError = null;
    const useForcedPort = !!process.env.EMAIL_PORT;
    
    // Try port 587 first (or forced port)
    try {
      transporter = createTransporter(false);
      console.log(`Attempting connection on port ${transporter.options.port} for password reset...`);
      
      // Verify connection with timeout
      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SMTP verification timeout')), 15000)
        )
      ]);
      console.log(`SMTP server connection verified on port ${transporter.options.port}`);
    } catch (verifyError) {
      console.warn(`Port ${transporter?.options?.port || 587} connection failed:`, verifyError.message);
      lastError = verifyError;
      connectionFailed = true;
      
      // Try port 465 as fallback only if EMAIL_PORT is not set
      if (!useForcedPort) {
        try {
          console.log('Attempting fallback connection on port 465...');
          transporter = createTransporter(true);
          
          await Promise.race([
            transporter.verify(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('SMTP verification timeout')), 15000)
            )
          ]);
          console.log('SMTP server connection verified on port 465');
          connectionFailed = false;
        } catch (fallbackError) {
          console.error('Port 465 connection also failed:', fallbackError.message);
          lastError = fallbackError;
          // Don't throw here - try to send anyway as verify can fail but send might work
          console.warn('SMTP verification failed on both ports, but attempting to send email anyway...');
        }
      } else {
        console.warn('Using forced port, skipping fallback. Attempting to send email anyway...');
      }
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
    
    // Send email with timeout - try sending, if fails try alternative port
    try {
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
    } catch (sendErr) {
      console.error('Email send failed on current port:', sendErr.message);
      
      // If we haven't tried port 465 yet and EMAIL_PORT is not set, try it now
      if ((!connectionFailed || !transporter || transporter.options.port === 587) && !process.env.EMAIL_PORT) {
        try {
          console.log('Retrying password reset email send on port 465...');
          transporter = createTransporter(true);
          
          const sendPromise = transporter.sendMail(mailOptions);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
          );
          
          const info = await Promise.race([sendPromise, timeoutPromise]);
          console.log('Password reset email sent successfully on port 465:', info.messageId);
          return { 
            success: true,
            messageId: info.messageId,
            response: info.response
          };
        } catch (retryErr) {
          console.error('Email send also failed on port 465:', retryErr.message);
          throw sendErr; // Throw original error
        }
      } else {
        throw sendErr;
      }
    }
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