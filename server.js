// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set up storage for uploaded images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'geotagged-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage });

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API route to get weather data
app.get('/api/weather', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const weatherApiKey = process.env.WEATHER_API_KEY;
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${weatherApiKey}`;
    
    const response = await axios.get(weatherUrl);
    res.json(response.data);
  } catch (error) {
    console.error('Weather API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// API route to get address from coordinates (reverse geocoding)
app.get('/api/geocode', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const geocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await axios.get(geocodeUrl, {
      headers: {
        'User-Agent': 'GeotaggingApp/1.0'
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Geocoding API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch location data' });
  }
});

// API route to save photos with metadata
app.post('/api/save-photo', upload.single('photo'), (req, res) => {
  try {
    const { locationData, weatherData, timestamp } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }
    
    // Save metadata along with photo
    const metadata = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      timestamp,
      locationData: JSON.parse(locationData),
      weatherData: JSON.parse(weatherData)
    };
    
    const metadataPath = path.join(__dirname, 'uploads', `${req.file.filename}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    res.json({
      success: true,
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    console.error('Save photo error:', error.message);
    res.status(500).json({ error: 'Failed to save photo' });
  }
});

// API route to get saved photos
app.get('/api/photos', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ photos: [] });
    }
    
    const files = fs.readdirSync(uploadsDir);
    const photos = files
      .filter(file => !file.endsWith('.json'))
      .map(filename => {
        const metadataFile = `${filename}.json`;
        let metadata = {};
        
        if (files.includes(metadataFile)) {
          const metadataContent = fs.readFileSync(path.join(uploadsDir, metadataFile), 'utf8');
          metadata = JSON.parse(metadataContent);
        }
        
        return {
          filename,
          url: `/uploads/${filename}`,
          ...metadata
        };
      });
    
    res.json({ photos });
  } catch (error) {
    console.error('Get photos error:', error.message);
    res.status(500).json({ error: 'Failed to retrieve photos' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
