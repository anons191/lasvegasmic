const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');

// Import routes
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const notificationRoutes = require('./routes/notifications');

dotenv.config(); // Load environment variables

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Parse incoming JSON requests

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

// Initialize GridFS
let gfs;
mongoose.connection.once('open', () => {
  // Initialize stream
  gfs = Grid(mongoose.connection.db, mongoose.mongo);
  gfs.collection('uploads');
  
  // Make gfs available to routes
  app.set('gfs', gfs);
  
  // Create storage engine for GridFS
  const storage = new GridFsStorage({
    url: process.env.MONGO_URI,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads'
          };
          resolve(fileInfo);
        });
      });
    }
  });
  
  // Set up Multer for file uploads
  const upload = multer({ storage });
  
  // Set upload middleware globally
  app.set('upload', upload);
  
  // File upload route
  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    res.json({ filename: req.file.filename });
  });
  
  // Get image route
  app.get('/api/image/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
      if (err) {
        return res.status(500).json({ error: err });
      }
      
      if (!file || file.length === 0) {
        return res.status(404).json({ error: 'No file exists' });
      }
      
      // Check if image
      if (file.contentType === 'image/jpeg' || file.contentType === 'image/png' || file.contentType === 'image/jpg') {
        // Create read stream
        const readstream = gfs.createReadStream(file.filename);
        // Pipe to response
        readstream.pipe(res);
      } else {
        res.status(404).json({ error: 'Not an image' });
      }
    });
  });
  
  // Delete image route
  app.delete('/api/image/:filename', (req, res) => {
    gfs.remove({ filename: req.params.filename, root: 'uploads' }, (err) => {
      if (err) {
        return res.status(500).json({ error: err });
      }
      res.json({ message: 'File deleted successfully' });
    });
  });
  
  // Index for geospatial queries
  try {
    mongoose.connection.db.collection('users').createIndex({ "location": "2dsphere" });
    mongoose.connection.db.collection('events').createIndex({ "location": "2dsphere" });
    console.log('Spatial indexes created successfully');
  } catch (err) {
    console.error('Error creating spatial indexes:', err);
  }
});

// Define routes
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);

// Home route for testing
app.get('/', (req, res) => {
  res.send('Welcome to the Open Mic App API!');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
  }
  
  res.status(500).json({ message: 'Something went wrong on the server' });
});

// Start the server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
