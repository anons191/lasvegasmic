const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const User = require('../../models/User');

// Middleware to check if user is a host
const isHost = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.userType !== 'host') {
      return res.status(403).json({ message: 'Only hosts can create or manage events' });
    }
    next();
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Import route handlers
const createEvent = require('./create');
const getAllEvents = require('./getAll');
const getNearbyEvents = require('./getNearby');
const getEventById = require('./getById');
const updateEvent = require('./update');
const deleteEvent = require('./delete');

// Create middleware for using the app's upload middleware
const useUpload = (req, res, next) => {
  const upload = req.app.get('upload');
  if (!upload) {
    return res.status(500).json({ message: 'Upload middleware not available' });
  }
  upload.single('image')(req, res, next);
};

// Register routes
router.post('/', [auth, isHost, useUpload], createEvent);
router.get('/', getAllEvents);
router.get('/nearby', getNearbyEvents);
router.get('/:id', getEventById);
router.put('/:id', [auth, isHost, useUpload], updateEvent);
router.delete('/:id', [auth, isHost], deleteEvent);

module.exports = router;
