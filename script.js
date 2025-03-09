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
                    const shortSummary = row['Short Summary - Date'] ? row['Short Summary - Date'].trim() : 'No Short Summary';
                    const summary = row['Summary - Date'] ? row['Summary - Date'].trim() : 'No Summary';
                    const blurb = row['Blurb'] ? row['Blurb'].trim() : 'No Blurb';
                    const locationStr = row['Location'] ? row['Location'].trim() : '';
                    const documentNames = row['Document Name'] ? row['Document Name'].split(',').map(name => name.trim()) : [];
                    const documentLinks = row['Document Link'] ? row['Document Link'].split(',').map(link => link.trim()) : [];

                    let location = null;
                    let marker = null;
                    if (locationStr) {
                        const [latStr, lonStr] = locationStr.split(',').map(coord => coord.trim());
                        const lat = parseFloat(latStr);
                        const lon = parseFloat(lonStr);
                        if (!isNaN(lat) && !isNaN(lon)) {
                            location = [lat, lon];
                            const numberedIcon = L.divIcon({
                                className: 'numbered-marker',
                                html: `<div>${index + 1}</div>`,
                                iconSize: [24, 24],
                                iconAnchor: [12, 12],
                                popupAnchor: [0, -12]
                            });
                            let popupContent = `<b>${shortSummary}</b><br>Date: ${dateStr}`;
                            if (documentNames.length > 0 && documentLinks.length > 0) {
                                for (let i = 0; i < Math.min(documentNames.length, documentLinks.length); i++) {
                                    popupContent += `<div class="document-link"><img src="icon-document.png" alt="Document"><a href="${documentLinks[i]}" target="_blank">${documentNames[i]}</a></div>`;
                                }
                            }
                            marker = L.marker(location, { icon: numberedIcon })
                                .addTo(map)
                                .bindPopup(popupContent);
                            marker.on('popupopen', () => {
                                const links = marker.getPopup().getElement().querySelectorAll('.document-link a');
                                links.forEach((link, i) => {
                                    link.addEventListener('click', () => window.open(documentLinks[i], '_blank'));
                                });
                            });
                            marker.on('click', () => {
                                const eventIndex = events.findIndex(e => e.marker === marker);
                                if (eventIndex !== -1) {
                                    const eventItem = document.querySelector(`.event-item[data-event-index="${eventIndex}"]`);
                                    if (eventItem) {
                                        const yearSection = eventItem.closest('.year');
                                        const decadeSection = yearSection.closest('.decade');
                                        const yearList = yearSection.querySelector('.year-list');
                                        const decadeList = decadeSection.querySelector('.decade-list');
                                        const yearToggle = yearSection.querySelector('.toggle');
                                        const decadeToggle = decadeSection.querySelector('.toggle');

                                        if (!decadeList.classList.contains('show')) {
                                            decadeList.classList.add('show');
                                            decadeToggle.classList.add('open');
                                        }
                                        if (!yearList.classList.contains('show')) {
                                            yearList.classList.add('show');
                                            yearToggle.classList.add('open');
                                        }

                                        eventItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                }
                            });
                            markers.push(marker);
                        } else {
                            console.warn(`Invalid coordinates in Location: ${locationStr}, no marker will be placed`, row);
                        }
                    } else {
                        console.warn('Missing Location data, no marker will be placed:', row);
                    }

                    return {
                        date: dateStr,
                        shortSummary: shortSummary,
                        summary: summary,
                        blurb: blurb,
                        location: location,
                        marker: marker,
                        index: index,
                        summaryState: 0,
                        documentNames: documentNames,
                        documentLinks: documentLinks
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
            displayDate = `${event.index + 1}: ${months[month - 1]} ${getOrdinal(day)}`;
        } else {
            const yearMatch = dateStr.match(/\d{4}/);
            if (yearMatch) {
                year = yearMatch[0];
            }
            console.warn('Non-standard date format, using full string:', dateStr);
            displayDate = `${event.index + 1}: ${dateStr}`;
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
                const dateText = document.createElement('span');
                dateText.textContent = event.displayDate;
                dateDiv.appendChild(dateText);

                if (event.documentNames.length > 0 && event.documentLinks.length > 0) {
                    const minLength = Math.min(event.documentNames.length, event.documentLinks.length);
                    for (let i = 0; i < minLength; i++) {
                        const docWrapper = document.createElement('div');
                        docWrapper.className = 'document-wrapper';
                        const docContainer = document.createElement('div');
                        docContainer.className = 'document-icon';
                        const documentIcon = document.createElement('img');
                        documentIcon.src = 'icon-document.png';
                        documentIcon.alt = 'Document';
                        const tooltip = document.createElement('div');
                        tooltip.className = 'document-tooltip';
                        tooltip.innerHTML = `<a href="${event.documentLinks[i]}" target="_blank">${event.documentNames[i]}</a>`;
                        tooltip.querySelector('a').addEventListener('click', (e) => {
                            e.stopPropagation();
                            window.open(event.documentLinks[i], '_blank');
                        });
                        docContainer.appendChild(documentIcon);
                        docWrapper.appendChild(docContainer);
                        docWrapper.appendChild(tooltip);
                        dateDiv.appendChild(docWrapper);
                    }
                }

                if (event.location) {
                    const locationIcon = document.createElement('img');
                    locationIcon.className = 'location-icon';
                    locationIcon.src = 'icon-location.svg';
                    locationIcon.alt = 'Location';
                    locationIcon.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (event.marker) {
                            map.setView(event.marker.getLatLng(), 10);
                            event.marker.openPopup();
                        }
                    });
                    dateDiv.appendChild(locationIcon);
                }

                const summaryDiv = document.createElement('div');
                summaryDiv.className = 'event-summary';
                summaryDiv.textContent = event.shortSummary;
                summaryDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    event.summaryState = (event.summaryState + 1) % 3;
                    summaryDiv.textContent = [event.shortSummary, event.summary, event.blurb][event.summaryState];
                });

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
        bubble.title = `${event.date}: ${event.shortSummary}`;
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
