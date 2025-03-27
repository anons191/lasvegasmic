const { Event } = require('../../models/Event');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const { Readable } = require('stream');
const mongoose = require('mongoose');

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
      image: req.file?.filename || '' // Store the filename if file was uploaded
    });

    // If file upload was attempted but failed, log a warning
    if (!req.file) {
      console.warn('⚠️ Image was not uploaded or failed.');
    } else {
      // We'll upload the image to GridFS and wait for it to complete before saving the event
      // This ensures the filename is properly saved in GridFS before we reference it
      const uploadImageToGridFS = () => {
        return new Promise((resolve, reject) => {
          // Create a GridFS bucket
          const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'uploads'
          });
          
          // Create a readable stream from the buffer
          const readableStream = Readable.from(req.file.buffer);
          
          // Generate a filename to store in GridFS
          const filename = req.file.originalname.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now();
          
          // Create a write stream to GridFS
          const uploadStream = bucket.openUploadStream(filename, {
            contentType: req.file.mimetype
          });
          
          // Handle completion with defensive check for file object
          uploadStream.on('finish', (file) => {
            if (!file || !file.filename) {
              console.warn('⚠️ GridFS upload finished but file is undefined or missing filename');
              return resolve(filename); // fallback to manually generated filename
            }
            console.log('✅ Image saved to GridFS:', file.filename);
            resolve(file.filename); // Resolve with the file.filename instead of our generated one
          });
          
          // Handle errors
          uploadStream.on('error', (err) => {
            console.error('❌ Image upload to GridFS failed:', err);
            reject(err);
          });
          
          // Pipe the file buffer to GridFS
          readableStream.pipe(uploadStream);
        });
      };
      
      // Upload the image and get the filename
      try {
        const filename = await uploadImageToGridFS();
        // Store the filename in the event document
        newEvent.image = filename;
      } catch (error) {
        console.error('Failed to upload image to GridFS:', error);
        // Continue with empty image value if upload fails
        newEvent.image = '';
      }
    }

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

    // Save the event with all data including image filename (which was set above)
    await newEvent.save();

    // Add event to host's hosting list
    // Validate user ID before updating
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      console.warn('Invalid ObjectId for user:', req.user.id);
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    await User.findByIdAndUpdate(req.user.id, {
      $push: { eventsHosting: newEvent._id }
    });

    // Validate event ID before using it in notifications
    if (!mongoose.Types.ObjectId.isValid(newEvent._id)) {
      console.warn('Invalid ObjectId for event:', newEvent._id);
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    // Notify comedians about new slots if they have notifications enabled
    const comedians = await User.find({
      userType: 'comedian',
      'notificationPreferences.enableNotifications': true,
      'notificationPreferences.availableSlotAlerts': true
    });

    const notifications = comedians.map(comedian => {
      // Validate comedian ID
      if (!mongoose.Types.ObjectId.isValid(comedian._id)) {
        console.warn('Invalid ObjectId for comedian:', comedian._id);
        return null;
      }
      
      return {
        recipient: comedian._id,
        type: 'slot_available',
        title: 'New Performance Slots Available',
        message: `New open mic event "${newEvent.name}" at ${newEvent.venue} on ${new Date(newEvent.date).toLocaleDateString()} has slots available.`,
        event: newEvent._id
      };
    }).filter(notification => notification !== null); // Filter out any null notifications

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
