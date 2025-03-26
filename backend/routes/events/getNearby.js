const { Event } = require('../../models/Event');

/**
 * Get nearby events based on geolocation
 * @route GET /api/events/nearby
 * @access Public
 */
module.exports = async (req, res) => {
  try {
    const { longitude, latitude, distance = 10000 } = req.query; // distance in meters
    
    if (!longitude || !latitude) {
      return res.status(400).json({ message: 'Longitude and latitude are required' });
    }
    
    const events = await Event.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(distance)
        }
      },
      date: { $gte: new Date() },
      status: { $ne: 'cancelled' }
    })
      .populate('host', 'name')
      .sort({ date: 1 })
      .limit(50);
    
    res.json(events);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
