// Google Sheet public CSV URL
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSQ-JCv36Mjy1zwU8S2RR1OqROG3apZDAX6-iwyUW-UCONOinGuoIDa7retZv365QwHxWl_dmmUVMOy/pub?gid=183252261&single=true&output=csv';

// Default location set to Kyiv (as a fallback)
const defaultLocation = [50.45, 30.52];

// Initialize the Leaflet map
const map = L.map('map').setView([48.3794, 31.1656], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Array to store markers
const markers = [];

// Fetch events from Google Sheet CSV
fetch(SHEET_CSV_URL)
    .then(response => response.text())
    .then(csvText => {
        // Parse CSV using Papa Parse
        Papa.parse(csvText, {
            header: true, // Treat first row as headers
            complete: function(results) {
                // Debug: Log headers and sample data
                console.log('Parsed Headers:', results.meta.fields);
                console.log('Parsed Data Sample:', results.data.slice(0, 3));

                const events = results.data.map((row, index) => {
                    // Safely access and trim CSV fields
                    const dateStr = row['Date-MDY'] ? row['Date-MDY'].trim() : '';
                    const description = row['Short Summary - Date'] ? row['Short Summary - Date'].trim() : '';
                    const locationStr = row['Location'] ? row['Location'].trim() : '';

                    // Skip rows with missing date or description
                    if (!dateStr || !description) {
                        console.warn('Skipping row due to missing date or description:', row);
                        return null;
                    }

                    // Parse Location column as latitude, longitude pair
                    let location;
                    if (locationStr) {
                        const [latStr, lonStr] = locationStr.split(',').map(coord => coord.trim());
                        const lat = parseFloat(latStr);
                        const lon = parseFloat(lonStr);
                        if (!isNaN(lat) && !isNaN(lon)) {
                            location = [lat, lon]; // Valid coordinate pair
                        } else {
                            console.warn(`Invalid coordinates in Location: ${locationStr}, using default`, row);
                            location = defaultLocation;
                        }
                    } else {
                        console.warn('Missing Location data, using default:', row);
                        location = defaultLocation;
                    }

                    return {
                        date: dateStr, // Treat as string, no parsing
                        description: description,
                        location: location, // Use parsed coordinates
                        story: 'The War in Ukraine',
                        index: index // Use index for timeline positioning
                    };
                }).filter(event => event !== null); // Remove skipped rows

                // Add markers to the map using Location column coordinates
                events.forEach(event => {
                    const marker = L.marker(event.location)
                        .addTo(map)
                        .bindPopup(`<b>${event.description}</b><br>Date: ${event.date}<br>Commentary: <a href="#">Link</a>`);
                    markers.push(marker);
                });

                // Populate sidebar and timeline
                populateSidebar(events);
                populateTimeline(events);
            },
            error: function(error) {
                console.error('Papa Parse error:', error);
            }
        });
    })
    .catch(error => {
        console.error('Error fetching CSV:', error);
    });

// Populate sidebar with interactive list items
function populateSidebar(events) {
    const eventList = document.getElementById('event-list');
    eventList.innerHTML = '';
    events.forEach((event, index) => {
        const li = document.createElement('li');
        li.textContent = `${event.date}: ${event.description}`;
        li.setAttribute('data-event-index', index);
        li.addEventListener('click', function() {
            const marker = markers[index];
            map.setView(marker.getLatLng(), 10);
            marker.openPopup();
        });
        eventList.appendChild(li);
    });
}

// Populate timeline with bubbles (position based on index)
function populateTimeline(events) {
    const timelineBar = document.querySelector('.timeline-bar');
    timelineBar.innerHTML = ''; // Clear existing bubbles
    events.forEach((event, index) => {
        const position = events.length > 1 ? (index / (events.length - 1)) * 100 : 50; // Even spacing, center if one event
        const bubble = document.createElement('div');
        bubble.className = 'event-bubble';
        bubble.style.left = `${position}%`;
        bubble.title = `${event.date}: ${event.description}`;
        timelineBar.appendChild(bubble);
    });
}

// Sidebar resize functionality
const sidebar = document.getElementById('sidebar');
const resizeHandle = document.querySelector('.resize-handle');
let isResizing = false;

resizeHandle.addEventListener('mousedown', function(e) {
    isResizing = true;
    e.preventDefault();
});

document.addEventListener('mousemove', function(e) {
    if (!isResizing) return;
    e.preventDefault();
    const container = document.getElementById('container');
    const containerRect = container.getBoundingClientRect();
    const mouseXInContainer = e.clientX - containerRect.left;
    let newWidth = (mouseXInContainer / containerRect.width) * 100;
    const minWidth = 10;
    const maxWidth = 50;
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    sidebar.style.flexBasis = `${newWidth}%`;
    map.invalidateSize();
});

document.addEventListener('mouseup', function() {
    isResizing = false;
});
