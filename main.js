 // DOM Elements
 const cameraStream = document.getElementById('camera-stream');
 const snapshotCanvas = document.getElementById('snapshot-canvas');
 const captureBtn = document.getElementById('captureBtn');
 const switchCameraBtn = document.getElementById('switchCameraBtn');
 const viewMapBtn = document.getElementById('viewMapBtn');
 const downloadBtn = document.getElementById('downloadBtn');
 const retakeBtn = document.getElementById('retakeBtn');
 const actionButtons = document.getElementById('actionButtons');
 const loadingIndicator = document.getElementById('loadingIndicator');
 const cameraContainer = document.getElementById('cameraContainer');
 const mapContainer = document.getElementById('mapContainer');

 // Global variables
 let stream;
 let currentPosition;
 let useFrontCamera = false;
 let photoTaken = false;
 let map;
 let miniMap;
 let geocoder;
 const weatherApiKey = "4d8fb5b93d4af21d66a2948710284366"; // OpenWeather API key
 
 // Initialize the application
 async function initApp() {
     try {
         // Start camera
         await startCamera();
         
         // Get user's location
         navigator.geolocation.getCurrentPosition(
             positionSuccess,
             positionError,
             { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
         );
         
         // Set up event listeners
         captureBtn.addEventListener('click', takePhoto);
         switchCameraBtn.addEventListener('click', switchCamera);
         viewMapBtn.addEventListener('click', toggleMapView);
         downloadBtn.addEventListener('click', downloadPhoto);
         retakeBtn.addEventListener('click', resetCamera);
         
         // Update date and time
         updateDateTime();
         setInterval(updateDateTime, 1000);
         
         // Load map libraries
         await loadMapDependencies();
     } catch (error) {
         console.error('Application initialization error:', error);
         alert('Error initializing the application. Please check camera and location permissions.');
     }
 }
 
 // Start camera with selected settings
 async function startCamera() {
     try {
         // Stop existing stream if any
         if (stream) {
             stream.getTracks().forEach(track => track.stop());
         }
         
         // Request camera access
         stream = await navigator.mediaDevices.getUserMedia({
             video: {
                 facingMode: useFrontCamera ? 'user' : 'environment',
                 width: { ideal: 1920 },
                 height: { ideal: 1080 }
             },
             audio: false
         });
         
         // Set video source
         cameraStream.srcObject = stream;
         
         // Hide loading indicator once camera is ready
         cameraStream.onloadedmetadata = () => {
             loadingIndicator.style.display = 'none';
         };
     } catch (error) {
         console.error('Camera access error:', error);
         alert('Could not access the camera. Please check your permissions.');
     }
 }
 
 // Switch between front and back cameras
 async function switchCamera() {
     useFrontCamera = !useFrontCamera;
     await startCamera();
 }
 
 // Handle successful location retrieval
 function positionSuccess(position) {
     currentPosition = {
         lat: position.coords.latitude,
         lng: position.coords.longitude
     };
     
     // Initialize maps with position
     initializeMap();
     initializeMiniMap();
     
     // Get reverse geocoding to determine address
     reverseGeocode(currentPosition);
     
     // Get weather data for the location
     getWeatherData(currentPosition);
 }
 
 // Handle location retrieval error
 function positionError(error) {
     console.error('Geolocation error:', error);
     locationTitle.textContent = 'Location Unavailable';
     locationAddress.textContent = 'Please check location permissions';
     loadingIndicator.style.display = 'none';
 }
 
 // Update date and time display
 function updateDateTime() {
     const now = new Date();
     
     // Format like: Friday, 19 March 2021 03:55 PM
     const options = {
         weekday: 'long',
         year: 'numeric',
         month: 'long',
         day: 'numeric',
         hour: '2-digit',
         minute: '2-digit'
     };
     
     datetimeElement.textContent = now.toLocaleDateString('en-US', options);
 }
 
 // Load Leaflet map dependencies
 function loadMapDependencies() {
     return new Promise((resolve) => {
         // Load Leaflet CSS
         if (!document.querySelector('link[href*="leaflet.css"]')) {
             const leafletCSS = document.createElement('link');
             leafletCSS.rel = 'stylesheet';
             leafletCSS.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
             document.head.appendChild(leafletCSS);
         }
         
         // Load Leaflet JS
         if (typeof L === 'undefined') {
             const leafletScript = document.createElement('script');
             leafletScript.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
             document.head.appendChild(leafletScript);
             
             leafletScript.onload = () => {
                 resolve();
             };
         } else {
             resolve();
         }
     });
 }
 
 // Initialize main map
 function initializeMap() {
     if (!currentPosition || typeof L === 'undefined') return;
     
     // Create map if it doesn't exist
     if (!map) {
         map = L.map('map', {
             zoomControl: false,
             attributionControl: false
         }).setView([currentPosition.lat, currentPosition.lng], 15);
         
         L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
             attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
         }).addTo(map);
         
         // Add marker for current position
         L.marker([currentPosition.lat, currentPosition.lng]).addTo(map)
             .bindPopup('Your current location')
             .openPopup();
         
         // Add zoom controls
         L.control.zoom({
             position: 'bottomright'
         }).addTo(map);
     } else {
         // Update existing map
         map.setView([currentPosition.lat, currentPosition.lng], 15);
     }
 }
 
 // Initialize mini map in the location card
 function initializeMiniMap() {
     if (!currentPosition || typeof L === 'undefined') return;
     
     // Create mini map if it doesn't exist
     if (!miniMap) {
         miniMap = L.map('mini-map', {
             zoomControl: false,
             attributionControl: false,
             dragging: false,
             touchZoom: false,
             scrollWheelZoom: false,
             doubleClickZoom: false
         }).setView([currentPosition.lat, currentPosition.lng], 15);
         
         L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(miniMap);
         
         // Add marker for current position
         L.marker([currentPosition.lat, currentPosition.lng]).addTo(miniMap);
     } else {
         // Update existing mini map
         miniMap.setView([currentPosition.lat, currentPosition.lng], 15);
     }
 }
 
 // Reverse geocode to get address from coordinates
 function reverseGeocode(position) {
     fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&zoom=18&addressdetails=1`)
         .then(response => response.json())
         .then(data => {
             if (data && data.display_name) {
                 // Format the title like in screenshot
                 const addressParts = [];
                 
                 // Building name or road
                 if (data.address.building) {
                     addressParts.push(data.address.building);
                 } else if (data.address.road) {
                     addressParts.push(data.address.road);
                 }
                 
                 // House number if available
                 if (data.address.house_number) {
                     addressParts[0] = `${addressParts[0]} ${data.address.house_number}`;
                 }
                 
                 // Create title from parts
                 locationTitle.textContent = addressParts.join(', ');
                 
                 // Format the full address
                 const fullAddress = [];
                 
                 if (data.address.road) {
                     let roadPart = data.address.road;
                     if (data.address.house_number) {
                         roadPart += ' ' + data.address.house_number;
                     }
                     fullAddress.push(roadPart);
                 }
                 
                 if (data.address.suburb) {
                     fullAddress.push(data.address.suburb);
                 }
                 
                 if (data.address.city || data.address.town || data.address.village) {
                     fullAddress.push(data.address.city || data.address.town || data.address.village);
                 }
                 
                 if (data.address.state) {
                     fullAddress.push(data.address.state);
                 }
                 
                 if (data.address.postcode) {
                     fullAddress.push(data.address.postcode);
                 }
                 
                 if (data.address.country) {
                     fullAddress.push(data.address.country);
                 }
                 
                 locationAddress.textContent = fullAddress.join(', ');
             } else {
                 // If reverse geocoding fails, show coordinates
                 locationTitle.textContent = `Location`;
                 locationAddress.textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
             }
         })
         .catch(error => {
             console.error('Reverse geocoding error:', error);
             locationTitle.textContent = `Location`;
             locationAddress.textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
         });
 }
 
 // Get weather data for the location
 function getWeatherData(position) {
     fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${position.lat}&lon=${position.lng}&units=metric&appid=${weatherApiKey}`)
         .then(response => response.json())
         .then(data => {
             if (data && data.main && data.main.temp) {
                 // Update temperature
                 temperatureElement.textContent = `${Math.round(data.main.temp)}°C`;
                 
                 // Update weather icon
                 if (data.weather && data.weather.length > 0) {
                     const weatherCondition = data.weather[0].id;
                     weatherIcon.textContent = getWeatherEmoji(weatherCondition);
                 }
             }
         })
         .catch(error => {
             console.error('Weather data error:', error);
             temperatureElement.textContent = '--°C';
         });
 }
 
 // Get emoji for weather condition
 function getWeatherEmoji(conditionId) {
     if (conditionId >= 200 && conditionId < 300) return '⛈️'; // Thunderstorm
     if (conditionId >= 300 && conditionId < 500) return '🌧️'; // Drizzle
     if (conditionId >= 500 && conditionId < 600) return '🌧️'; // Rain
     if (conditionId >= 600 && conditionId < 700) return '❄️'; // Snow
     if (conditionId >= 700 && conditionId < 800) return '🌫️'; // Atmosphere
     if (conditionId === 800) return '☀️'; // Clear
     if (conditionId > 800) return '☁️'; // Clouds
     return '🌤️'; // Default
 }
 
 // Take a photo
 function takePhoto() {
     if (!stream) return;
     
     const context = snapshotCanvas.getContext('2d');
     
     // Set canvas dimensions
     snapshotCanvas.width = cameraStream.videoWidth;
     snapshotCanvas.height = cameraStream.videoHeight;
     
     // Draw the current frame
     context.drawImage(cameraStream, 0, 0);
     
     // Show snapshot and hide video stream
     snapshotCanvas.style.display = 'block';
     cameraStream.style.display = 'none';
     
     // Show action buttons
     actionButtons.style.display = 'flex';
     
     // Set photo taken flag
     photoTaken = true;
 }
 
 // Download photo with overlay info
 function downloadPhoto() {
     if (!photoTaken) return;
     
     // Create a canvas for the final image
     const finalCanvas = document.createElement('canvas');
     const context = finalCanvas.getContext('2d');
     
     // Set dimensions
     finalCanvas.width = snapshotCanvas.width;
     finalCanvas.height = snapshotCanvas.height;
     
     // Draw original photo
     context.drawImage(snapshotCanvas, 0, 0);
     
     // Get overlay info card position
     const infoCard = document.querySelector('.info-container');
     const rect = infoCard.getBoundingClientRect();
     
     // Calculate scale factors (viewport to canvas)
     const scaleX = snapshotCanvas.width / window.innerWidth;
     const scaleY = snapshotCanvas.height / window.innerHeight;
     
     // Calculate overlay position in canvas coordinates
     const overlayX = rect.left * scaleX;
     const overlayY = rect.top * scaleY;
     const overlayWidth = rect.width * scaleX;
     const overlayHeight = rect.height * scaleY;
     
     // Draw semi-transparent background
     context.fillStyle = 'rgba(40, 40, 40, 0.8)';
     context.fillRect(overlayX, overlayY, overlayWidth, overlayHeight);
     
     // Draw location details
     context.fillStyle = 'white';
     context.font = `bold ${16 * scaleY}px Arial`;
     context.fillText(locationTitle.textContent, overlayX + 90 * scaleX, overlayY + 20 * scaleY);
     
     context.font = `${12 * scaleY}px Arial`;
     context.fillText(locationAddress.textContent, overlayX + 90 * scaleX, overlayY + 40 * scaleY);
     
     context.font = `${12 * scaleY}px Arial`;
     context.fillText(datetimeElement.textContent, overlayX + 90 * scaleX, overlayY + 60 * scaleY);
     
     // Draw weather info
     context.font = `${16 * scaleY}px Arial`;
     context.fillText(weatherIcon.textContent, overlayX + overlayWidth - 60 * scaleX, overlayY + 30 * scaleY);
     
     context.font = `${14 * scaleY}px Arial`;
     context.fillText(temperatureElement.textContent, overlayX + overlayWidth - 40 * scaleX, overlayY + 30 * scaleY);
     
     // Draw map placeholder area
     context.fillStyle = '#eee';
     context.fillRect(overlayX + 10 * scaleX, overlayY + 10 * scaleY, 70 * scaleX, 70 * scaleY);
     
     // Draw map pin
     context.fillStyle = 'red';
     context.font = `${24 * scaleY}px Arial`;
     context.fillText('📍', overlayX + 45 * scaleX, overlayY + 45 * scaleY);
     
     // Create download link
     const link = document.createElement('a');
     link.download = `geotagged-photo-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.jpg`;
     link.href = finalCanvas.toDataURL('image/jpeg', 0.9);
     link.click();
 }
 
 // Reset camera to take another photo
 function resetCamera() {
     photoTaken = false;
     snapshotCanvas.style.display = 'none';
     cameraStream.style.display = 'block';
     actionButtons.style.display = 'none';
 }
 
 // Toggle between camera and map views
 function toggleMapView() {
     if (mapContainer.style.display === 'none' || mapContainer.style.display === '') {
         // Show map view
         mapContainer.style.display = 'block';
         cameraContainer.style.display = 'none';
         
         // Initialize/refresh map
         initializeMap();
         if (map) {
             map.invalidateSize();
         }
     } else {
         // Show camera view
         mapContainer.style.display = 'none';
         cameraContainer.style.display = 'block';
         
         // Show the appropriate camera view based on state
         if (photoTaken) {
             snapshotCanvas.style.display = 'block';
             cameraStream.style.display = 'none';
             actionButtons.style.display = 'flex';
         } else {
             snapshotCanvas.style.display = 'none';
             cameraStream.style.display = 'block';
         }
     }
 }
 
 // Handle window resize
 window.addEventListener('resize', () => {
     if (map) map.invalidateSize();
     if (miniMap) miniMap.invalidateSize();
 });
 
 // Initialize app when page loads
 document.addEventListener('DOMContentLoaded', initApp);
 // Improved reverse geocode function to better format location information
function reverseGeocode(position) {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&zoom=18&addressdetails=1`)
        .then(response => response.json())
        .then(data => {
            if (data && data.display_name) {
                // Format location title more intelligently
                let title = '';
                
                // Try to find the most relevant name for the location
                if (data.address.building) {
                    title = data.address.building;
                } else if (data.address.amenity) {
                    title = data.address.amenity;
                } else if (data.address.leisure) {
                    title = data.address.leisure;
                } else if (data.address.shop) {
                    title = data.address.shop;
                } else if (data.address.tourism) {
                    title = data.address.tourism;
                } else if (data.address.office) {
                    title = data.address.office;
                } else if (data.address.road) {
                    // When just a road, include suburb/neighborhood if available
                    title = data.address.road;
                    if (data.address.suburb || data.address.neighbourhood) {
                        title += `, ${data.address.suburb || data.address.neighbourhood}`;
                    }
                } else if (data.address.residential) {
                    title = data.address.residential;
                } else if (data.address.suburb || data.address.neighbourhood) {
                    title = data.address.suburb || data.address.neighbourhood;
                } else if (data.address.city || data.address.town || data.address.village) {
                    title = data.address.city || data.address.town || data.address.village;
                }
                
                // Add house number if available and not already included
                if (data.address.house_number && title !== data.address.road) {
                    title = `${title} ${data.address.house_number}`;
                }
                
                // Format full address more intelligently
                const addressParts = [];
                
                // Start with the most specific location information
                if (data.address.road) {
                    let roadPart = data.address.road;
                    if (data.address.house_number) {
                        roadPart += ' ' + data.address.house_number;
                    }
                    addressParts.push(roadPart);
                }
                
                // Add neighborhood/suburb information
                if (data.address.suburb || data.address.neighbourhood) {
                    addressParts.push(data.address.suburb || data.address.neighbourhood);
                }
                
                // Add city/town/village
                if (data.address.city || data.address.town || data.address.village) {
                    addressParts.push(data.address.city || data.address.town || data.address.village);
                }
                
                // Add district if available and different from city
                if (data.address.county || data.address.district) {
                    const district = data.address.county || data.address.district;
                    const city = data.address.city || data.address.town || data.address.village || '';
                    if (district && district !== city) {
                        addressParts.push(district);
                    }
                }
                
                // Add state/province
                if (data.address.state || data.address.province) {
                    addressParts.push(data.address.state || data.address.province);
                }
                
                // Add postal code
                if (data.address.postcode) {
                    addressParts.push(data.address.postcode);
                }
                
                // Add country
                if (data.address.country) {
                    addressParts.push(data.address.country);
                }
                
                // Set the location title and full address
                locationTitle.textContent = title || 'Current Location';
                locationAddress.textContent = addressParts.join(', ');
                
                // Store original address data for potential use
                currentLocation = {
                    title: title,
                    address: addressParts.join(', '),
                    raw: data.address
                };
            } else {
                // Fallback to coordinates if geocoding fails
                locationTitle.textContent = 'Current Location';
                locationAddress.textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
            }
        })
        .catch(error => {
            console.error('Reverse geocoding error:', error);
            locationTitle.textContent = 'Current Location';
            locationAddress.textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
        });
}