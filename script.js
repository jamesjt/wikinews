// script.js (Ensure saved as UTF-8)

// Define default location (Kyiv) - only used as a fallback if needed elsewhere
const defaultLocation = [50.45, 30.52];

// Initialize the Leaflet map
const map = L.map('map').setView([48.3794, 31.1656], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Array to store markers (for reference, but not used for indexing)
const markers = [];

let events = [];

const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function getOrdinal(day) {
    if (day > 3 && day < 21) return `${day}th`;
    switch (day % 10) {
        case 1: return `${day}st`;
        case 2: return `${day}nd`;
        case 3: return `${day}rd`;
        default: return `${day}th`;
    }
}

// Fetch and parse CSV
fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSQ-JCv36Mjy1zwU8S2RR1OqROG3apZDAX6-iwyUW-UCONOinGuoIDa7retZv365QwHxWl_dmmUVMOy/pub?gid=183252261&single=true&output=csv')
    .then(response => response.text())
    .then(csvText => {
        Papa.parse(csvText, {
            header: true,
            complete: function(results) {
                console.log('Parsed Data Sample:', results.data.slice(0, 5));
                events = results.data.map((row, index) => {
                    const dateStr = row['Date-MDY'] ? row['Date-MDY'].trim() : 'Unknown Date';
                    const description = row['Short Summary - Date'] ? row['Short Summary - Date'].trim() : 'No Description';
                    const locationStr = row['Location'] ? row['Location'].trim() : '';

                    let location = null;
                    let marker = null;
                    if (locationStr) {
                        const [latStr, lonStr] = locationStr.split(',').map(coord => coord.trim());
                        const lat = parseFloat(latStr);
                        const lon = parseFloat(lonStr);
                        if (!isNaN(lat) && !isNaN(lon)) {
                            location = [lat, lon];
                            marker = L.marker(location)
                                .addTo(map)
                                .bindPopup(`<b>${description}</b><br>Date: ${dateStr}<br>Commentary: <a href="#">Link</a>`);
                            markers.push(marker);
                        } else {
                            console.warn(`Invalid coordinates in Location: ${locationStr}, no marker will be placed`, row);
                        }
                    } else {
                        console.warn('Missing Location data, no marker will be placed:', row);
                    }

                    return {
                        date: dateStr,
                        description: description,
                        location: location,
                        marker: marker,
                        index: index
                    };
                }).filter(event => event !== null);

                buildSidebar(events);
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
    const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

    events.forEach(event => {
        const dateStr = event.date;
        let year = 'Unknown';
        let displayDate = dateStr;

        if (datePattern.test(dateStr)) {
            const [month, day, yearStr] = dateStr.split('/').map(part => parseInt(part, 10));
            year = yearStr.toString();
            displayDate = `${months[month - 1]} ${getOrdinal(day)}`;
        } else {
            const yearMatch = dateStr.match(/\d{4}/);
            if (yearMatch) {
                year = yearMatch[0];
            }
            console.warn('Non-standard date format, using full string:', dateStr);
        }

        const decade = year === 'Unknown' ? 'Unknown' : `${Math.floor(parseInt(year) / 10) * 10}s`;
        if (!groupedEvents[decade]) groupedEvents[decade] = {};
        if (!groupedEvents[decade][year]) groupedEvents[decade][year] = [];
        event.displayDate = displayDate;
        groupedEvents[decade][year].push(event);
    });

    const sortedDecades = Object.keys(groupedEvents).sort((a, b) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return parseInt(a) - parseInt(b);
    });
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
        decadeToggle.appendChild(document.createTextNode(` ${decade} `));
        const decadeEvents = Object.values(groupedEvents[decade]).flat();
        const eventCount = decadeEvents.length;
        const countSpan = document.createElement('span');
        countSpan.className = 'event-count';
        countSpan.textContent = eventCount;
        decadeToggle.appendChild(countSpan);
        decadeDiv.appendChild(decadeToggle);

        const yearDiv = document.createElement('div');
        yearDiv.className = 'decade-list';
        const sortedYears = Object.keys(groupedEvents[decade]).sort((a, b) => {
            if (a === 'Unknown') return 1;
            if (b === 'Unknown') return -1;
            return parseInt(a) - parseInt(b);
        });

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
            yearToggle.appendChild(document.createTextNode(` ${year} `));
            const yearEvents = groupedEvents[decade][year];
            const yearEventCount = yearEvents.length;
            const yearCountSpan = document.createElement('span');
            yearCountSpan.className = 'event-count';
            yearCountSpan.textContent = yearEventCount;
            yearToggle.appendChild(yearCountSpan);
            yearSection.appendChild(yearToggle);

            const eventDiv = document.createElement('div');
            eventDiv.className = 'year-list';
            yearEvents.forEach(event => {
                const eventItem = document.createElement('div');
                eventItem.className = 'event-item';

                const dateDiv = document.createElement('div');
                dateDiv.className = 'event-date';
                dateDiv.textContent = event.displayDate;

                if (event.location) {
                    const locationIcon = document.createElement('img');
                    locationIcon.className = 'location-icon';
                    locationIcon.src = 'icon-location.svg';
                    locationIcon.alt = 'Location';
                    dateDiv.appendChild(locationIcon);
                }

                const summaryDiv = document.createElement('div');
                summaryDiv.className = 'event-summary';
                summaryDiv.textContent = event.description;

                eventItem.appendChild(dateDiv);
                eventItem.appendChild(summaryDiv);
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
            const event = events[index];
            if (event.marker) {
                map.setView(event.marker.getLatLng(), 10);
                event.marker.openPopup();
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
