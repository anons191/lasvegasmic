const { Event } = require('../../models/Event');

/**
 * Get all events with filtering and pagination
 * @route GET /api/events
 * @access Public
 */
module.exports = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'upcoming' } = req.query;
    
    const filterOptions = {};
    
    // Filter by status
    if (status === 'upcoming') {
      filterOptions.date = { $gte: new Date() };
      filterOptions.status = { $ne: 'cancelled' };
    } else if (status === 'past') {
      filterOptions.date = { $lt: new Date() };
    } else if (status !== 'all') {
      filterOptions.status = status;
    }
    
    // Count total documents
    const total = await Event.countDocuments(filterOptions);
    
    // Find events with pagination
    const events = await Event.find(filterOptions)
      .sort({ date: 1 }) // Sort by date ascending
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('host', 'name')
      .exec();
    
    res.json({
      events,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
