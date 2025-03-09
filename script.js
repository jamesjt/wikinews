// script.js (Ensure saved as UTF-8)

// Define default location (Kyiv) - only used as a fallback if needed elsewhere
const defaultLocation = [50.45, 30.52];

// Initialize the Leaflet map
const map = L.map('map').setView([48.3794, 31.1656], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Array to store markers
const markers = [];

// Fetch and parse CSV
fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSQ-JCv36Mjy1zwU8S2RR1OqROG3apZDAX6-iwyUW-UCONOinGuoIDa7retZv365QwHxWl_dmmUVMOy/pub?gid=183252261&single=true&output=csv')
    .then(response => response.text())
    .then(csvText => {
        Papa.parse(csvText, {
            header: true,
            complete: function(results) {
                const events = results.data.map((row, index) => {
                    const dateStr = row['Date-MDY'] ? row['Date-MDY'].trim() : '';
                    const description = row['Short Summary - Date'] ? row['Short Summary - Date'].trim() : '';
                    const locationStr = row['Location'] ? row['Location'].trim() : '';

                    if (!dateStr || !description) {
                        console.warn('Skipping row due to missing date or description:', row);
                        return null;
                    }

                    let location = null; // Default to null (no marker)
                    if (locationStr) {
                        const [latStr, lonStr] = locationStr.split(',').map(coord => coord.trim());
                        const lat = parseFloat(latStr);
                        const lon = parseFloat(lonStr);
                        if (!isNaN(lat) && !isNaN(lon)) {
                            location = [lat, lon]; // Only set if valid
                        } else {
                            console.warn(`Invalid coordinates in Location: ${locationStr}, no marker will be placed`, row);
                        }
                    } else {
                        console.warn('Missing Location data, no marker will be placed:', row);
                    }

                    return {
                        date: dateStr,
                        description: description,
                        location: location, // Null if no valid location
                        index: index
                    };
                }).filter(event => event !== null);

                // Add markers to the map only for events with valid locations
                events.forEach((event, index) => {
                    event.index = index; // Ensure index is set
                    if (event.location) { // Only create marker if location exists
                        const marker = L.marker(event.location)
                            .addTo(map)
                            .bindPopup(`<b>${event.description}</b><br>Date: ${event.date}<br>Commentary: <a href="#">Link</a>`);
                        markers.push(marker);
                    }
                });

                // Build the collapsible sidebar (all events, with or without location)
                buildSidebar(events);

                // Populate timeline with bubbles (all events)
                populateTimeline(events);
            }
        });
    })
    .catch(error => {
        console.error('Error fetching CSV:', error);
    });

// Build the sidebar with collapsible decade and year sections
function buildSidebar(events) {
    const groupedEvents = {};
    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;

    events.forEach(event => {
        const dateStr = event.date;
        if (datePattern.test(dateStr)) {
            const [month, day, year] = dateStr.split('/').map(Number);
            const decade = `${Math.floor(year / 10) * 10}s`;
            if (!groupedEvents[decade]) groupedEvents[decade] = {};
            if (!groupedEvents[decade][year]) groupedEvents[decade][year] = [];
            event.displayDate = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`;
            groupedEvents[decade][year].push(event);
        } else {
            console.warn('Skipping event with invalid date format:', event);
        }
    });

    const sortedDecades = Object.keys(groupedEvents).sort((a, b) => parseInt(a) - parseInt(b));
    const eventList = document.getElementById('event-list');
    eventList.innerHTML = '';

    sortedDecades.forEach(decade => {
        const decadeDiv = document.createElement('div');
        decadeDiv.className = 'decade';
        const decadeToggle = document.createElement('span');
        decadeToggle.className = 'toggle';
        const decadeIndicator = document.createElement('img');
        decadeIndicator.className = 'toggle-indicator';
        decadeIndicator.src = 'icon-arrow-accordion.svg';
        decadeIndicator.alt = 'Toggle';
        decadeToggle.appendChild(decadeIndicator);
        decadeToggle.appendChild(document.createTextNode(` ${decade}`));
        const decadeEvents = Object.values(groupedEvents[decade]).flat();
        const eventCount = decadeEvents.length;
        decadeToggle.appendChild(document.createTextNode(` (${eventCount} events)`));
        decadeDiv.appendChild(decadeToggle);

        const yearDiv = document.createElement('div');
        yearDiv.className = 'decade-list';
        const sortedYears = Object.keys(groupedEvents[decade]).sort((a, b) => parseInt(a) - parseInt(b));

        sortedYears.forEach(year => {
            const yearSection = document.createElement('div');
            yearSection.className = 'year';
            const yearToggle = document.createElement('span');
            yearToggle.className = 'toggle';
            const yearIndicator = document.createElement('img');
            yearIndicator.className = 'toggle-indicator';
            yearIndicator.src = 'icon-arrow-accordion.svg';
            yearIndicator.alt = 'Toggle';
            yearToggle.appendChild(yearIndicator);
            yearToggle.appendChild(document.createTextNode(` ${year}`));
            const yearEvents = groupedEvents[decade][year];
            const yearEventCount = yearEvents.length;
            yearToggle.appendChild(document.createTextNode(` (${yearEventCount} events)`));
            yearSection.appendChild(yearToggle);

            const eventDiv = document.createElement('div');
            eventDiv.className = 'year-list';
            yearEvents.forEach(event => {
                const eventItem = document.createElement('div');
                eventItem.className = 'event-item';
                eventItem.textContent = `${event.displayDate}: ${event.description}`;
                eventItem.setAttribute('data-event-index', event.index);
                eventDiv.appendChild(eventItem);
            });
            yearSection.appendChild(eventDiv);
            yearDiv.appendChild(yearSection);
        });

        decadeDiv.appendChild(yearDiv);
        eventList.appendChild(decadeDiv);
    });

    document.querySelectorAll('.toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const sublist = this.nextElementSibling;
            if (sublist.classList.contains('show')) {
                sublist.classList.remove('show');
                this.classList.remove('open');
            } else {
                sublist.classList.add('show');
                this.classList.add('open');
            }
        });
    });

    document.querySelectorAll('.event-item').forEach(item => {
        item.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-event-index'));
            const marker = markers[index];
            if (marker) { // Only attempt to center if a marker exists
                map.setView(marker.getLatLng(), 10);
                marker.openPopup();
            }
        });
    });
}

// Populate timeline with bubbles (position based on index)
function populateTimeline(events) {
    const timelineBar = document.querySelector('.timeline-bar');
    timelineBar.innerHTML = '<span class="timeline-indicator" style="left: 50%"></span>';
    events.forEach((event, index) => {
        const position = events.length > 1 ? (index / (events.length - 1)) * 100 : 50;
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
