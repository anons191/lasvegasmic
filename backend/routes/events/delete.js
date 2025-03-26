const { Event } = require('../../models/Event');
const User = require('../../models/User');
const Notification = require('../../models/Notification');

/**
 * Delete an event
 * @route DELETE /api/events/:id
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
      return res.status(403).json({ message: 'You are not authorized to delete this event' });
    }
    
    // Delete image from GridFS if exists
    if (event.image) {
      const gfs = req.app.get('gfs');
      gfs.remove({ filename: event.image, root: 'uploads' }, (err) => {
        if (err) {
          console.error('Failed to delete image:', err);
          // Continue even if image deletion fails
        }
      });
    }
    
    // Remove event from attendees' lists and comedians' performance slots
    const attendeeIds = event.attendees.map(a => a.user);
    const comedianIds = event.timeSlots
      .filter(slot => slot.comedian)
      .map(slot => slot.comedian);
    
    await User.updateMany(
      { _id: { $in: attendeeIds } },
      { $pull: { eventsAttending: event._id } }
    );
    
    await User.updateMany(
      { _id: { $in: comedianIds } },
      { $pull: { performanceSlots: { event: event._id } } }
    );
    
    // Remove event from host's hosting list
    await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { eventsHosting: event._id } }
    );
    
    // Create notifications for attendees and comedians
    const notifications = [
      ...attendeeIds.map(userId => ({
        recipient: userId,
        type: 'event_cancelled',
        title: 'Event Deleted',
        message: `The event "${event.name}" at ${event.venue} on ${new Date(event.date).toLocaleDateString()} has been deleted.`,
        event: event._id
      })),
      ...comedianIds.map(userId => ({
        recipient: userId,
        type: 'event_cancelled',
        title: 'Performance Cancelled',
        message: `The event "${event.name}" at ${event.venue} where you were scheduled to perform has been deleted.`,
        event: event._id
      }))
    ];
    
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
    
    // Delete event
    await Event.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(500).send('Server error');
  }
};
