const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    enum: ['guest', 'comedian', 'host'],
    required: true
  },
  profilePicture: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  // For Guest users - events they're attending
  eventsAttending: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],
  // For Comedian users - events they're performing at
  performanceSlots: [{
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimeSlot'
    }
  }],
  // For Host users - events they've created
  eventsHosting: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],
  // Notification preferences for comedians
  notificationPreferences: {
    enableNotifications: {
      type: Boolean,
      default: true
    },
    availableSlotAlerts: {
      type: Boolean,
      default: true
    },
    upcomingPerformanceReminders: {
      type: Boolean,
      default: true
    },
    reminderTime: {
      type: String,
      enum: ['1hour', '1day', '1week'],
      default: '1day'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add index for geolocation queries
userSchema.index({ location: '2dsphere' });

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;