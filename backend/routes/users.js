const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const { Event } = require('../models/Event');
const auth = require('../middleware/auth');
const sendVerificationEmail = require('../utils/sendVerificationEmail');

// @route   GET /api/users/model-test
// @desc    Check model references
// @access  Private
router.get('/model-test', auth, async (req, res) => {
  try {
    // Get the models from mongoose
    const models = mongoose.modelNames();
    console.log('📦 Available Mongoose models:', models);
    
    // Try to get a direct reference to the Event model
    const EventModel = mongoose.model('Event');
    console.log('🍟 Event model exists:', !!EventModel);
    
    res.json({ models, eventModelExists: !!EventModel });
  } catch (err) {
    console.error('🔥 Error in model-test route:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST /api/users/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, userType } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    console.log('Generated token:', token);

    // Create new user
    user = new User({
      name,
      email,
      password,
      userType,
      verifyToken: String(token) // Ensure token is stored as string
    });

    // Save the user and ensure it was successful
    const savedUser = await user.save();
    console.log('User saved with verification token:', savedUser.verifyToken);
    
    // Double check if the token was saved correctly
    const checkUser = await User.findOne({ email });
    console.log('Verification token in DB:', checkUser.verifyToken);

    // Send verification email
    await sendVerificationEmail(email, token);

    // Return success message
    res.status(201).json({ message: 'Registration successful. Please check your email to verify your account.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/verify-email
// @desc    Verify user email with token
// @access  Public
router.get('/verify-email', async (req, res) => {
  const token = String(req.query.token || '').trim();
  console.log('Token received:', token);
  try {
    const users = await User.find({}, 'email verifyToken');
    console.log('Available tokens in DB:', users.map(u => ({
      id: u._id,
      email: u.email,
      verifyToken: u.verifyToken
    })));
    const user = await User.findOne({ verifyToken: token });
    if (!user) {
      // 🔁 Check if token was just verified
      const recentlyVerified = await User.findOne({ isVerified: true, verifyToken: '' });
      if (recentlyVerified) {
        console.log('⚠️ Token was already used. Returning success response.');
        return res.status(200).json({ message: '✅ Email already verified.' });
      }
      console.log('❌ No user found with this token!');
      return res.status(400).json({ message: 'Invalid or expired token.' });
    }
    if (user.isVerified) {
      console.log('⚠️ Email already verified. Skipping update.');
      return res.status(200).json({ message: '✅ Email already verified.' });
    }
    user.isVerified = true;
    user.verifyToken = '';
    await user.save();
    console.log(`✅ User ${user.email} has been verified.`);
    res.status(200).json({ message: '✅ Email verified successfully!' });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ message: 'Server error during verification.' });
  }
});

// @route   POST /api/users/resend-verification
// @desc    Resend verification email
// @access  Public
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }
    
    // Generate new token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    user.verifyToken = String(verifyToken);
    
    // Save user and validate token was stored correctly
    const savedUser = await user.save();
    console.log('Updated user with new verification token:', savedUser.verifyToken);
    
    // Send verification email
    await sendVerificationEmail(email, verifyToken);
    
    res.status(200).json({ message: 'Verification email has been resent' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const payload = {
      user: {
        id: user.id,
        isVerified: user.isVerified // ✅ Add this!
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified
          }
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/users/me
// @desc    Get current user's profile
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    console.log('🔎 User ID being searched:', req.user.id);
    let user = await User.findById(req.user.id)
      .select('-password')
      .populate({
        path: 'eventsHosting',
        model: 'Event',
        select: 'name venue date image attendeeCount'
      })
      .populate({
        path: 'eventsAttending',
        select: 'name venue date image'
      })
      .populate({
        path: 'performanceSlots.event',
        select: 'name venue date image timeSlots'
      });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user = user.toObject(); // convert to plain object for modification
    // Manually populate `slot` from embedded event.timeSlots
    if (Array.isArray(user.performanceSlots)) {
      user.performanceSlots = user.performanceSlots.map(slotItem => {
        const { event, slot } = slotItem;
        const matchingSlot =
          event?.timeSlots?.find(ts => ts._id.toString() === slot?.toString()) || null;
        return {
          ...slotItem,
          slot: matchingSlot,
        };
      });
    }
    console.log('✅ FINAL populated user:');
    console.log('- eventsHosting:', JSON.stringify(user.eventsHosting, null, 2));
    console.log('- eventsAttending:', JSON.stringify(user.eventsAttending, null, 2));
    console.log('- performanceSlots:', JSON.stringify(user.performanceSlots, null, 2));
    res.json(user);
  } catch (err) {
    console.error('🔥 Error in /me route:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/me/test-populate
// @desc    Test route to verify population works
// @access  Private
router.get('/me/test-populate', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate({
        path: 'eventsHosting',
        model: 'Event',
        select: 'name'
      });
    console.log('🎯 Test Populated user:', user);
    console.log('🔎 eventsHosting value:', user.eventsHosting);
    res.json(user);
  } catch (err) {
    console.error('🔥 Error in test-populate route:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/me
// @desc    Update user profile
// @access  Private
router.put('/me', auth, async (req, res) => {
  try {
    const { name, bio, profilePicture, location } = req.body;
    
    // Build update object
    const userFields = {};
    if (name) userFields.name = name;
    if (bio) userFields.bio = bio;
    if (profilePicture) userFields.profilePicture = profilePicture;
    if (location) userFields.location = location;

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: userFields },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/users/notification-preferences
// @desc    Update notification preferences (for comedians)
// @access  Private
router.put('/notification-preferences', auth, async (req, res) => {
  try {
    const { enableNotifications, availableSlotAlerts, upcomingPerformanceReminders, reminderTime } = req.body;
    
    // Get user and verify they are a comedian
    const user = await User.findById(req.user.id);
    if (user.userType !== 'comedian') {
      return res.status(400).json({ message: 'Only comedians can update notification preferences' });
    }
    
    // Build update object
    const notificationPrefs = {};
    if (enableNotifications !== undefined) notificationPrefs['notificationPreferences.enableNotifications'] = enableNotifications;
    if (availableSlotAlerts !== undefined) notificationPrefs['notificationPreferences.availableSlotAlerts'] = availableSlotAlerts;
    if (upcomingPerformanceReminders !== undefined) notificationPrefs['notificationPreferences.upcomingPerformanceReminders'] = upcomingPerformanceReminders;
    if (reminderTime) notificationPrefs['notificationPreferences.reminderTime'] = reminderTime;

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: notificationPrefs },
      { new: true }
    ).select('-password');

    res.json(updatedUser);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/users/events/:id/attend
// @desc    RSVP to attend an event (for guests)
// @access  Private
router.post('/events/:id/attend', auth, async (req, res) => {
  try {
    const { attendingFor } = req.body;
    
    // Get user and verify they're not the host
    const user = await User.findById(req.user.id);
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if user is the host (they can't attend their own event as a guest)
    if (event.host.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot attend your own event as a guest' });
    }
    
    // Check if user is already attending
    const isAttending = event.attendees.some(attendee => attendee.user.toString() === req.user.id);
    if (isAttending) {
      return res.status(400).json({ message: 'You are already attending this event' });
    }
    
    // Add user to attendees
    event.attendees.push({ 
      user: req.user.id,
      attendingFor: attendingFor || ''
    });
    
    // Add event to user's attending list
    if (!user.eventsAttending.includes(req.params.id)) {
      user.eventsAttending.push(req.params.id);
    }
    
    await event.save();
    await user.save();
    
    res.json({ message: 'Successfully RSVP\'d to event' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/users/events/:id/attend
// @desc    Cancel RSVP for an event
// @access  Private
router.delete('/events/:id/attend', auth, async (req, res) => {
  try {
    // Get user and event
    const user = await User.findById(req.user.id);
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if user is attending
    const isAttending = event.attendees.some(attendee => attendee.user.toString() === req.user.id);
    if (!isAttending) {
      return res.status(400).json({ message: 'You are not attending this event' });
    }
    
    // Remove user from attendees
    event.attendees = event.attendees.filter(attendee => attendee.user.toString() !== req.user.id);
    
    // Remove event from user's attending list
    user.eventsAttending = user.eventsAttending.filter(eventId => eventId.toString() !== req.params.id);
    
    await event.save();
    await user.save();
    
    res.json({ message: 'Successfully cancelled RSVP' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/users/events/:eventId/slots/:slotId
// @desc    Book a performance slot (for comedians)
// @access  Private
router.post('/events/:eventId/slots/:slotId', auth, async (req, res) => {
  try {
    // Get user and verify they are a comedian
    const user = await User.findById(req.user.id);
    if (user.userType !== 'comedian') {
      return res.status(400).json({ message: 'Only comedians can book performance slots' });
    }
    
    // Get event and slot
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Find the time slot
    const slot = event.timeSlots.id(req.params.slotId);
    if (!slot) {
      return res.status(404).json({ message: 'Time slot not found' });
    }
    
    // Check if slot is already taken
    if (slot.isTaken) {
      return res.status(400).json({ message: 'This slot is already taken' });
    }
    
    // Assign comedian to slot
    slot.comedian = req.user.id;
    slot.isTaken = true;
    
    // Add slot to comedian's performances
    user.performanceSlots.push({
      event: req.params.eventId,
      slot: req.params.slotId
    });
    
    await event.save();
    await user.save();
    
    res.json({ message: 'Successfully booked performance slot' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/users/events/:eventId/slots/:slotId
// @desc    Cancel a performance slot booking (for comedians)
// @access  Private
router.delete('/events/:eventId/slots/:slotId', auth, async (req, res) => {
  try {
    // Get user
    const user = await User.findById(req.user.id);
    
    // Get event and slot
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Find the time slot
    const slot = event.timeSlots.id(req.params.slotId);
    if (!slot) {
      return res.status(404).json({ message: 'Time slot not found' });
    }
    
    // Check if user is the one who booked the slot
    if (slot.comedian.toString() !== req.user.id) {
      return res.status(400).json({ message: 'You did not book this slot' });
    }
    
    // Clear slot
    slot.comedian = null;
    slot.isTaken = false;
    
    // Remove slot from comedian's performances
    user.performanceSlots = user.performanceSlots.filter(
      performance => !(performance.event.toString() === req.params.eventId && 
                      performance.slot.toString() === req.params.slotId)
    );
    
    await event.save();
    await user.save();
    
    res.json({ message: 'Successfully cancelled performance slot' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/users/nearby
// @desc    Get nearby users
// @access  Private
router.get('/nearby', auth, async (req, res) => {
  try {
    const { longitude, latitude, distance = 10000, userType } = req.query; // distance in meters
    
    if (!longitude || !latitude) {
      return res.status(400).json({ message: 'Longitude and latitude are required' });
    }
    
    const query = {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(distance)
        }
      }
    };
    
    // Add userType filter if specified
    if (userType) {
      query.userType = userType;
    }
    
    const users = await User.find(query)
      .select('name userType location profilePicture')
      .limit(50);
    
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;