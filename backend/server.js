const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const Grid = require('gridfs-stream');
const { Readable } = require('stream');

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
mongoose.connect(process.env.MONGO_URI)
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

// Set up Multer with memory storage instead of GridFS storage
const storage = multer.memoryStorage();
const upload = multer({ 
storage,
limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Set upload middleware globally
app.set('upload', upload);
  
  // File upload route - updated for consistency and better error handling
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
      console.warn('Upload failed: no file returned.');
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    try {
      // Create a unique filename
      const filename = crypto.randomBytes(16).toString('hex') + path.extname(req.file.originalname);
      
      // Wrap the upload in a Promise for better async handling
      const uploadToGridFS = () => {
        return new Promise((resolve, reject) => {
          // Create a GridFS bucket
          const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'uploads'
          });
          
          // Create a readable stream from the buffer
          const readableStream = Readable.from(req.file.buffer);
          
          // Create an upload stream to GridFS
          const uploadStream = bucket.openUploadStream(filename, {
            contentType: req.file.mimetype
          });
          
          // Handle upload completion
          uploadStream.on('finish', (file) => {
            console.log('✅ File uploaded to GridFS:', file.filename);
            resolve(file);
          });
          
          // Handle upload errors
          uploadStream.on('error', (error) => {
            console.error('❌ Error uploading to GridFS:', error);
            reject(error);
          });
          
          // Pipe the readable stream to the upload stream
          readableStream.pipe(uploadStream);
        });
      };
      
      // Execute the upload and wait for it to complete
      const file = await uploadToGridFS();
      
      // Return the filename to the client
      return res.json({ filename: file.filename });
      
    } catch (error) {
      console.error('🔥 Error in file upload:', error);
      return res.status(500).json({ message: 'Internal server error during file upload' });
    }
  });
  
  // Get image route - updated to use GridFSBucket for compatibility
  app.get('/api/image/:filename', async (req, res) => {
    try {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
      });
      
      const files = await mongoose.connection.db
        .collection('uploads.files')
        .findOne({ filename: req.params.filename });
        
      if (!files || !files.contentType) {
        return res.status(404).json({ error: 'File not found or invalid' });
      }
      
      // Check if image
      if (files.contentType === 'image/jpeg' || files.contentType === 'image/png' || files.contentType === 'image/jpg') {
        res.set('Content-Type', files.contentType);
        const downloadStream = bucket.openDownloadStreamByName(req.params.filename);
        downloadStream.pipe(res);
      } else {
        res.status(404).json({ error: 'Not an image' });
      }
    } catch (error) {
      console.error('🔥 Error serving image:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Delete image route - updated to use GridFSBucket for compatibility
  app.delete('/api/image/:filename', async (req, res) => {
    try {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
      });
      
      // Find the file first to get its ID
      const file = await mongoose.connection.db
        .collection('uploads.files')
        .findOne({ filename: req.params.filename });
        
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Delete the file by ID
      await bucket.delete(file._id);
      
      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      console.error('🔥 Error deleting image:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
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
