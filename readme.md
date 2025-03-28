# Las Vegas Mic App

A platform connecting comedians, venues, and comedy fans in Las Vegas.

## Features

- User registration and authentication
- Email verification system
- Event creation and management
- Comedian performance booking
- Guest RSVP functionality
- Geolocation features
- Notification system

## Email Verification System

The app implements a complete email verification system:

1. **User Registration**: When users register, a verification token is generated and stored in their user profile.
2. **Verification Email**: An email with a verification link is sent to the user's email address.
3. **Email Verification**: When the user clicks the verification link, their account is marked as verified.
4. **Login Protection**: Users cannot log in until they verify their email.
5. **Resend Verification**: If users don't receive the email, they can request a new verification email.

## API Endpoints

### Authentication

- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Log in
- `GET /api/users/verify-email?token=TOKEN` - Verify email address
- `POST /api/users/resend-verification` - Resend verification email

### User Profile

- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile
- `PUT /api/users/notification-preferences` - Update notification preferences

### Events

- Various endpoints for event creation, management, and interaction

## Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables in `.env`:
   - `MONGO_URI` - MongoDB connection string
   - `JWT_SECRET` - Secret for JWT tokens
   - `PORT` - Server port (default: 5001)
   - `EMAIL_USERNAME` - Gmail account for sending emails
   - `EMAIL_PASSWORD` - App password for Gmail
   - `FRONTEND_URL` - URL of the frontend application
4. Start the server with `npm run dev` for development
