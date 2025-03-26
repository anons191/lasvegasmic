const { Event } = require('../../models/Event');

/**
 * Get event by ID
 * @route GET /api/events/:id
 * @access Public
 */
module.exports = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('host', 'name email')
      .populate('attendees.user', 'name')
      .populate('timeSlots.comedian', 'name');
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
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
