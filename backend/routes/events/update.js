const { Event } = require('../../models/Event');
const User = require('../../models/User');
const Notification = require('../../models/Notification');

/**
 * Update an event
 * @route PUT /api/events/:id
 * @access Private (host only)
 */
module.exports = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if user is the host
    if (event.host.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to update this event' });
    }
    
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
      timeSlots,
      status
    } = req.body;
    
    // Update event fields
    if (name) event.name = name;
    if (description) event.description = description;
    if (venue) event.venue = venue;
    if (address) event.address = JSON.parse(address);
    if (longitude && latitude) {
      event.location.coordinates = [parseFloat(longitude), parseFloat(latitude)];
    }
    if (date) event.date = new Date(date);
    if (startTime) event.startTime = new Date(startTime);
    if (endTime) event.endTime = new Date(endTime);
    if (status && ['upcoming', 'ongoing', 'completed', 'cancelled'].includes(status)) {
      event.status = status;
    }
    
    // Update image if provided
    if (req.file) {
      // Delete old image if exists
      if (event.image) {
        const gfs = req.app.get('gfs');
        gfs.remove({ filename: event.image, root: 'uploads' }, (err) => {
          if (err) {
            console.error('Failed to delete old image:', err);
          }
        });
      }
      
      // Set the new image filename
      event.image = req.file.filename;
    }
    
    // Update time slots if provided
    if (timeSlots) {
      const parsedSlots = JSON.parse(timeSlots);
      
      // Filter out slots that already have comedians booked
      const existingSlots = event.timeSlots.filter(slot => slot.isTaken);
      const existingSlotIds = existingSlots.map(slot => slot._id.toString());
      
      // Clear slots that don't have bookings
      event.timeSlots = existingSlots;
      
      // Add new slots with order numbers starting after existing slots
      parsedSlots.forEach((slot, index) => {
        // Skip if this is an existing slot that should be preserved
        if (slot._id && existingSlotIds.includes(slot._id)) {
          return;
        }
        
        event.timeSlots.push({
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
          order: existingSlots.length + index + 1
        });
      });
    }
    
    await event.save();
    
    // If event is cancelled, notify all attendees and booked comedians
    if (status === 'cancelled') {
      // Get all users who need to be notified
      const attendeeIds = event.attendees.map(a => a.user);
      const comedianIds = event.timeSlots
        .filter(slot => slot.comedian)
        .map(slot => slot.comedian);
      
      // Create notifications
      const notifications = [
        ...attendeeIds.map(userId => ({
          recipient: userId,
          type: 'event_cancelled',
          title: 'Event Cancelled',
          message: `The event "${event.name}" at ${event.venue} on ${new Date(event.date).toLocaleDateString()} has been cancelled.`,
          event: event._id
        })),
        ...comedianIds.map(userId => ({
          recipient: userId,
          type: 'event_cancelled',
          title: 'Performance Cancelled',
          message: `The event "${event.name}" at ${event.venue} where you were scheduled to perform has been cancelled.`,
          event: event._id
        }))
      ];
      
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
      
      // Remove event from attendees' lists and comedians' performance slots
      await User.updateMany(
        { _id: { $in: attendeeIds } },
        { $pull: { eventsAttending: event._id } }
      );
      
      await User.updateMany(
        { _id: { $in: comedianIds } },
        { $pull: { performanceSlots: { event: event._id } } }
      );
    }
    // If slots were added, notify comedians
    else if (timeSlots) {
      // Check if new slots were added
      const newSlotsCount = event.timeSlots.filter(slot => !slot.isTaken).length;
      
      if (newSlotsCount > 0) {
        // Find comedians with notifications enabled
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
            message: `Event "${event.name}" at ${event.venue} has ${newSlotsCount} new performance slots available.`,
            event: event._id
          };
        });
        
        if (notifications.length > 0) {
          await Notification.insertMany(notifications);
        }
      }
    }
    
    res.json(event);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(500).send('Server error');
  }
};
