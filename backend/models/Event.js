const mongoose = require('mongoose');

// Define the TimeSlot schema for comedian performance slots
const timeSlotSchema = new mongoose.Schema({
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  comedian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isTaken: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    required: true
  }
});

// Define the Event schema
const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  venue: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  image: {
    type: String,
    default: '' // URL to the event image (960x1200)
  },
  timeSlots: [timeSlotSchema],
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    attendingFor: {
      type: String,
      trim: true,
      default: ''
    }
  }],
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add index for geolocation queries
eventSchema.index({ location: '2dsphere' });

// Virtual for getting total attendees count
eventSchema.virtual('attendeeCount').get(function() {
  return this.attendees.length;
});

// Virtual for getting number of comedians booked
eventSchema.virtual('comedianCount').get(function() {
  return this.timeSlots.filter(slot => slot.isTaken).length;
});

// Virtual for getting number of available slots
eventSchema.virtual('availableSlotCount').get(function() {
  return this.timeSlots.filter(slot => !slot.isTaken).length;
});

// Set virtuals to be included in JSON output
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

// Create the TimeSlot model
const TimeSlot = mongoose.model('TimeSlot', timeSlotSchema);

// Create the Event model from the schema
const Event = mongoose.model('Event', eventSchema);

module.exports = { Event, TimeSlot };