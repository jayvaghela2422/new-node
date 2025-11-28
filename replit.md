# WorkStream Automations API

## Overview
Backend API for WorkStream Automations - a system for managing appointments, recordings, notifications, and integrating with Fireflies.ai for meeting transcriptions.

## Current State
- **Status**: Imported and configured for Replit environment
- **Server**: Running on 0.0.0.0:3000 (publicly accessible)
- **Database**: MongoDB Atlas (requires IP whitelisting)
- **Language**: Node.js with ES6 modules
- **Framework**: Express.js

## Recent Changes (November 26, 2025)
- Imported from GitHub repository
- Updated CORS configuration to allow all origins for Replit environment
- Changed server binding to 0.0.0.0:3000 for deployment compatibility
- Installed all npm dependencies
- Configured workflow to run backend server with nodemon
- Created .env.example documentation
- Modified database connection to provide helpful error messages
- Added S3 upload endpoint for recordings (`POST /api/recordings/upload-s3`)

## Project Architecture

### Core Technologies
- **Backend**: Express.js (Node.js)
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens) with session management
- **Email**: Nodemailer (Gmail SMTP)
- **External API**: Fireflies.ai integration
- **File Storage**: AWS S3 for recording uploads

### Directory Structure
```
├── config/
│   └── db.js                 # MongoDB connection & session cleanup
├── controllers/
│   ├── appointmentController.js
│   ├── authController.js
│   ├── dashboardController.js
│   ├── firefliesController.js
│   ├── notificationController.js
│   └── recordingController.js
├── middleware/
│   └── authMiddleware.js     # JWT authentication middleware
├── models/
│   ├── appointmentModel.js
│   ├── notificationModel.js
│   ├── otpModel.js
│   ├── recordingModel.js
│   ├── sessionModel.js
│   └── userModel.js
├── routes/
│   ├── appointmentRoutes.js
│   ├── authRoutes.js
│   ├── dashboardRoutes.js
│   ├── firefliesRoutes.js
│   ├── notificationRoutes.js
│   └── recordingRoutes.js
├── utils/
│   ├── emailService.js       # Email sending functionality
│   ├── firefliesService.js   # Fireflies.ai API integration
│   └── s3Service.js          # AWS S3 upload functionality
└── server.js                 # Main application entry point
```

### API Endpoints
- `/api/auth` - Authentication (login, register, OTP verification)
- `/api/profile` - User profile management
- `/api/fireflies` - Fireflies.ai integration
- `/api/appointments` - Appointment management
- `/api/recordings` - Recording management
- `/api/dashboard` - Dashboard data
- `/api/notifications` - Notification management

### Key Features
1. **User Authentication**: JWT-based with refresh tokens and session management
2. **Session Cleanup**: Automatic cleanup of expired sessions every 30 seconds
3. **Email Notifications**: Gmail SMTP for sending appointment and recording notifications
4. **Fireflies Integration**: GraphQL API integration for meeting transcriptions
5. **File Uploads**: Multer for handling file uploads
6. **S3 Storage**: AWS S3 integration for cloud file storage

## Environment Variables

All required environment variables are stored as Replit Secrets:
- `MONGO_URI` - MongoDB Atlas connection string
- `JWT_SECRET` - Secret key for JWT signing
- `EMAIL_USER` - Gmail address for sending emails
- `EMAIL_PASSWORD` - Gmail App Password
- `FIREFLIES_API_KEY` - Fireflies.ai API key
- `PORT` - Server port (default: 3000)

AWS S3 (for file uploads):
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret access key
- `AWS_S3_BUCKET` - S3 bucket name
- `AWS_REGION` - AWS region (default: us-east-1)

Optional:
- `FRONTEND_URL` - Frontend application URL for email links

## MongoDB Atlas Setup

**IMPORTANT**: If using MongoDB Atlas, you must whitelist Replit's IP addresses:

1. Log in to MongoDB Atlas
2. Go to your cluster → Network Access
3. Click "Add IP Address"
4. Either:
   - Add `0.0.0.0/0` to allow access from anywhere (easier but less secure)
   - Or add specific Replit IP ranges for better security

Without this step, the database connection will fail.

## Running the Application

The application runs automatically via the configured workflow:
- **Workflow**: Backend API
- **Command**: `npm run dev`
- **Port**: 3000
- **Auto-restart**: Enabled via nodemon

### Manual Commands
```bash
npm install          # Install dependencies
npm run dev          # Run with auto-reload (development)
npm start            # Run without auto-reload (production)
```

## Development Notes

### CORS Configuration
- Configured to allow all origins for Replit environment
- Credentials enabled for cookie-based authentication
- Supports GET, POST, PUT, DELETE, OPTIONS methods

### Security
- All sensitive credentials stored in Replit Secrets
- JWT tokens expire after 1 hour
- Password hashing with bcryptjs
- Session-based authentication with automatic cleanup

### Known Issues
- Mongoose duplicate schema index warnings (non-critical, can be fixed by reviewing model definitions)
- Database connection requires IP whitelisting on MongoDB Atlas

## Next Steps

If you need to:
1. **Test the API**: Use tools like Postman or curl to test endpoints
2. **Connect a frontend**: Update FRONTEND_URL environment variable
3. **Deploy**: Configure deployment settings for production
4. **Fix schema warnings**: Review models to remove duplicate index definitions
