// script.js

// Define default location (Kyiv)
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

                    let location;
                    if (locationStr) {
                        const [latStr, lonStr] = locationStr.split(',').map(coord => coord.trim());
                        const lat = parseFloat(latStr);
                        const lon = parseFloat(lonStr);
                        if (!isNaN(lat) && !isNaN(lon)) {
                            location = [lat, lon];
                        } else {
                            console.warn(`Invalid coordinates in Location: ${locationStr}, using default`, row);
                            location = defaultLocation;
                        }
                    } else {
                        console.warn('Missing Location data, using default:', row);
                        location = defaultLocation;
                    }

                    return {
                        date: dateStr,
                        description: description,
                        location: location,
                        index: index
                    };
                }).filter(event => event !== null);

                // Add markers to the map
                events.forEach((event, index) => {
                    event.index = index; // Ensure index is set
                    const marker = L.marker(event.location)
                        .addTo(map)
                        .bindPopup(`<b>${event.description}</b><br>Date: ${event.date}<br>Commentary: <a href="#">Link</a>`);
                    markers.push(marker);
                });

                // Build the collapsible sidebar
                buildSidebar(events);
            }
        });
    })
    .catch(error => {
        console.error('Error fetching CSV:', error);
    });

// Build the sidebar with collapsible decade and year sections
function buildSidebar(events) {
    // Group events by decade and year
    const groupedEvents = {};
    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/; // Regex for "MM/DD/YYYY"

    events.forEach(event => {
        const dateStr = event.date;
        if (datePattern.test(dateStr)) {
            const [month, day, year] = dateStr.split('/').map(Number);
            const decade = `${Math.floor(year / 10) * 10}s`; // e.g., "1990s"
            if (!groupedEvents[decade]) groupedEvents[decade] = {};
            if (!groupedEvents[decade][year]) groupedEvents[decade][year] = [];
            event.displayDate = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`; // "MM/DD"
            groupedEvents[decade][year].push(event);
        } else {
            console.warn('Skipping event with invalid date format:', event);
        }
    });

    // Sort decades and years numerically
    const sortedDecades = Object.keys(groupedEvents).sort((a, b) => parseInt(a) - parseInt(b));
    const eventList = document.getElementById('event-list');
    eventList.innerHTML = '';

    sortedDecades.forEach(decade => {
        const decadeLi = document.createElement('li');
        decadeLi.className = 'decade';
        const decadeToggle = document.createElement('span');
        decadeToggle.className = 'toggle';
        const decadeIndicator = document.createElement('span');
        decadeIndicator.className = 'indicator';
        decadeIndicator.textContent = '[+]';
        decadeToggle.appendChild(decadeIndicator);
        decadeToggle.appendChild(document.createTextNode(` ${decade}`));
        const decadeEvents = Object.values(groupedEvents[decade]).flat();
        const eventCount = decadeEvents.length;
        decadeToggle.appendChild(document.createTextNode(` (${eventCount} events)`));
        decadeLi.appendChild(decadeToggle);

        const yearUl = document.createElement('ul');
        yearUl.className = 'year-list';
        const sortedYears = Object.keys(groupedEvents[decade]).sort((a, b) => parseInt(a) - parseInt(b));

        sortedYears.forEach(year => {
            const yearLi = document.createElement('li');
            yearLi.className = 'year';
            const yearToggle = document.createElement('span');
            yearToggle.className = 'toggle';
            const yearIndicator = document.createElement('span');
            yearIndicator.className = 'indicator';
            yearIndicator.textContent = '[+]';
            yearToggle.appendChild(yearIndicator);
            yearToggle.appendChild(document.createTextNode(` ${year}`));
            const yearEvents = groupedEvents[decade][year];
            const yearEventCount = yearEvents.length;
            yearToggle.appendChild(document.createTextNode(` (${yearEventCount} events)`));
            yearLi.appendChild(yearToggle);

            const eventUl = document.createElement('ul');
            eventUl.className = 'event-list';
            yearEvents.forEach(event => {
                const eventLi = document.createElement('li');
                eventLi.className = 'event-item';
                eventLi.textContent = `${event.displayDate}: ${event.description}`;
                eventLi.setAttribute('data-event-index', event.index);
                eventUl.appendChild(eventLi);
            });
            yearLi.appendChild(eventUl);
            yearUl.appendChild(yearLi);
        });

        decadeLi.appendChild(yearUl);
        eventList.appendChild(decadeLi);
    });

    // Add toggle functionality for collapsible sections
    document.querySelectorAll('.toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const sublist = this.nextElementSibling;
            const indicator = this.querySelector('.indicator');
            if (sublist.classList.contains('show')) {
                sublist.classList.remove('show');
                indicator.textContent = '[+]';
            } else {
                sublist.classList.add('show');
                indicator.textContent = '[-]';
            }
        });
    });

    // Add map interactivity for event items
    document.querySelectorAll('.event-item').forEach(item => {
        item.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-event-index'));
            const marker = markers[index];
            map.setView(marker.getLatLng(), 10);
            marker.openPopup();
        });
    });
}
