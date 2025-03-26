const { Event } = require('../../models/Event');
const User = require('../../models/User');
const Notification = require('../../models/Notification');

/**
 * Create a new event
 * @route POST /api/events
 * @access Private (host only)
 */
module.exports = async (req, res) => {
  try {
    const {
      name,
      description,
      venue,
      address,
      longitude,
      latitude,
      date,
      startTime,
      endTime,
      timeSlots
    } = req.body;

    // Create a new event
    const newEvent = new Event({
      name,
      description,
      venue,
      address: JSON.parse(address), // Parse from JSON string if sent as string
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      date: new Date(date),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      host: req.user.id,
      image: req.file ? req.file.filename : '' // Store the filename if file was uploaded
    });

    // Add time slots
    if (timeSlots) {
      const parsedSlots = JSON.parse(timeSlots);
      parsedSlots.forEach((slot, index) => {
        newEvent.timeSlots.push({
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
          order: index + 1
        });
      });
    }

    await newEvent.save();

    // Add event to host's hosting list
    await User.findByIdAndUpdate(req.user.id, {
      $push: { eventsHosting: newEvent._id }
    });

    // Notify comedians about new slots if they have notifications enabled
    const comedians = await User.find({
      userType: 'comedian',
      'notificationPreferences.enableNotifications': true,
      'notificationPreferences.availableSlotAlerts': true
    });

    const notifications = comedians.map(comedian => {
      return {
        recipient: comedian._id,
        type: 'slot_available',
        title: 'New Performance Slots Available',
        message: `New open mic event "${newEvent.name}" at ${newEvent.venue} on ${new Date(newEvent.date).toLocaleDateString()} has slots available.`,
        event: newEvent._id
      };
    });

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json(newEvent);
  } catch (err) {
    console.error(err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).send('Server error');
  }
};
