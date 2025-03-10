// script.js

/*
Fixed the invalid regular expression issue by removing extra backslashes.
We use a simpler syntax: /^\\d{1,2}\\/\\d{1,2}\\/\\d{4}$/ is replaced with
/^\\d{1,2}\\/\\d{1,2}\\/\\d{4}$/.test() to avoid the 'Invalid flags' error.
*/

const defaultLocation = [50.45, 30.52];
const map = L.map('map').setView([48.3794, 31.1656], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

const markers = [];
let events = [];
let zoomLevel = 1; // Controls scaling factor
const zoomScales = [1, 1.5, 2]; // Scaling factors for event density adjustment

// Store the current effective scale for the timeline.
// This will help ensure the entire timeline is shown at the initial view.
// On further zooms, the timeline can exceed container width and scroll.
let timelineScale = 1;

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getOrdinal(day) {
    if (day > 3 && day < 21) return `${day}th`;
    switch (day % 10) {
        case 1: return `${day}st`;
        case 2: return `${day}nd`;
        case 3: return `${day}rd`;
        default: return `${day}th`;
    }
}

fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSQ-JCv36Mjy1zwU8S2RR1OqROG3apZDAX6-iwyUW-UCONOinGuoIDa7retZv365QwHxWl_dmmUVMOy/pub?gid=183252261&single=true&output=csv')
    .then(response => response.text())
    .then(csvText => {
        Papa.parse(csvText, {
            header: true,
            complete: function(results) {
                events = results.data.map((row, index) => {
                    const dateStr = row['Date-MDY']?.trim() || 'Unknown Date';
                    const shortSummary = row['Short Summary - Date']?.trim() || 'No Short Summary';
                    const summary = row['Summary - Date']?.trim() || 'No Summary';
                    const blurb = row['Blurb']?.trim() || 'No Blurb';
                    const locationStr = row['Location']?.trim() || '';
                    const documentNames = row['Document Name']?.split(',').map(name => name.trim()) || [];
                    const documentLinks = row['Document Link']?.split(',').map(link => link.trim()) || [];

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
                            if (documentNames.length && documentLinks.length) {
                                for (let i = 0; i < Math.min(documentNames.length, documentLinks.length); i++) {
                                    popupContent += `<div class="document-link"><img src="icon-document.png" alt="Document"><a href="${documentLinks[i]}" target="_blank">${documentNames[i]}</a></div>`;
                                }
                            }
                            marker = L.marker(location, { icon: numberedIcon }).addTo(map).bindPopup(popupContent);
                            marker.on('click', () => {
                                const eventItem = document.querySelector(`.event-item[data-event-index="${index}"]`);
                                if (eventItem) expandAndScrollToEvent(eventItem);
                            });
                            markers.push(marker);
                        }
                    }

                    return {
                        date: dateStr,
                        // Use test() for the date format check, avoiding extra backslash escapes.
                        timestamp: /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr) ? new Date(dateStr).getTime() : null,
                        shortSummary,
                        summary,
                        blurb,
                        location,
                        marker,
                        index,
                        summaryState: 0,
                        documentNames,
                        documentLinks
                    };
                }).filter(event => event.timestamp); // Only include events with valid timestamps

                buildSidebar(events);
                populateTimeline();

                const timeline = document.getElementById('timeline');
                document.querySelector('.zoom-in').addEventListener('click', () => zoomTimeline(1));
                document.querySelector('.zoom-out').addEventListener('click', () => zoomTimeline(-1));
                timeline.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    zoomTimeline(e.deltaY < 0 ? 1 : -1);
                });
            }
        });
    })
    .catch(error => console.error('Error fetching CSV:', error));

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
            if (yearMatch) year = yearMatch[0];
        }

        const decade = year === 'Unknown' ? 'Unknown' : `${Math.floor(parseInt(year) / 10) * 10}s`;
        if (!groupedEvents[decade]) groupedEvents[decade] = {};
        if (!groupedEvents[decade][year]) groupedEvents[decade][year] = [];
        event.displayDate = displayDate;
        groupedEvents[decade][year].push(event);
    });

    const sortedDecades = Object.keys(groupedEvents).sort((a, b) => a === 'Unknown' ? 1 : b === 'Unknown' ? -1 : parseInt(a) - parseInt(b));
    const eventList = document.getElementById('event-list');
    eventList.innerHTML = '';

    sortedDecades.forEach(decade => {
        const decadeDiv = document.createElement('div');
        decadeDiv.className = 'decade';
        const decadeToggle = document.createElement('span');
        decadeToggle.className = 'toggle';
        decadeToggle.innerHTML = `<img class="toggle-indicator" src="icon-arrow-accordion.svg" alt="Toggle"> ${decade} <span class="event-count">${Object.values(groupedEvents[decade]).flat().length}</span>`;
        decadeDiv.appendChild(decadeToggle);

        const yearDiv = document.createElement('div');
        yearDiv.className = 'decade-list';
        const sortedYears = Object.keys(groupedEvents[decade]).sort((a, b) => a === 'Unknown' ? 1 : b === 'Unknown' ? -1 : parseInt(a) - parseInt(b));

        sortedYears.forEach(year => {
            const yearSection = document.createElement('div');
            yearSection.className = 'year';
            yearSection.innerHTML = `<span class="toggle"><img class="toggle-indicator" src="icon-arrow-accordion.svg" alt="Toggle"> ${year} <span class="event-count">${groupedEvents[decade][year].length}</span></span>`;
            const eventDiv = document.createElement('div');
            eventDiv.className = 'year-list';

            groupedEvents[decade][year].forEach(event => {
                const eventItem = document.createElement('div');
                eventItem.className = 'event-item';
                eventItem.setAttribute('data-event-index', event.index);
                eventItem.innerHTML = `
                    <div class="event-date">
                        <span class="event-number-circle${event.location ? ' has-location' : ''}">${event.index + 1}</span>
                        <span>${event.displayDate}</span>
                        <div class="icons-container">
                            ${event.documentNames.length ? `<div class="document-wrapper"><div class="document-icon"><img src="icon-document.png" alt="Document"></div><div class="document-tooltip">${event.documentNames.map((name, i) => `<div class="doc-entry"><img src="icon-document.png" alt="Document"><a href="${event.documentLinks[i]}" target="_blank">${name}</a></div>`).join('')}</div></div>` : ''}
                            ${event.location ? `<img class="location-icon" src="icon-location.svg" alt="Location">` : ''}
                        </div>
                    </div>
                    <div class="event-summary">${event.shortSummary}</div>
                `;
                eventItem.querySelector('.event-summary').addEventListener('click', () => {
                    event.summaryState = (event.summaryState + 1) % 3;
                    eventItem.querySelector('.event-summary').textContent = [event.shortSummary, event.summary, event.blurb][event.summaryState];
                });
                if (event.location) {
                    eventItem.querySelector('.location-icon').addEventListener('click', () => {
                        map.setView(event.marker.getLatLng(), 10);
                        event.marker.openPopup();
                    });
                }
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
            sublist.classList.toggle('show');
            this.classList.toggle('open');
        });
    });
}

function zoomTimeline(delta) {
    const oldZoomLevel = zoomLevel;
    zoomLevel = Math.max(1, Math.min(3, zoomLevel + delta));
    if (oldZoomLevel !== zoomLevel) {
        populateTimeline();
    }
}

function populateTimeline() {
    const timelineBar = document.querySelector('.timeline-bar');
    timelineBar.innerHTML = '<div class="timeline-line"></div>';

    const minTime = Math.min(...events.map(e => e.timestamp));
    const maxTime = Math.max(...events.map(e => e.timestamp));
    const timeRange = maxTime - minTime;

    // Get the visible width of the timeline container.
    const timelineContainer = document.getElementById('timeline');
    const containerWidth = timelineContainer.clientWidth - 40; // Some padding on sides

    // Sort events by timestamp so they appear in chronological order.
    events.sort((a, b) => a.timestamp - b.timestamp);

    // We track how far along the timeline we've drawn.
    let lastPos = 0;

    // Add decade markers.
    const years = events.map(e => parseInt(e.date.match(/\d{4}/)?.[0])).filter(y => y);
    if (!years.length) return;

    const startYear = Math.min(...years);
    const endYear = Math.max(...years);

    for (let year = Math.floor(startYear / 10) * 10; year <= endYear; year += 10) {
        const yearTime = new Date(`01/01/${year}`).getTime();
        const timeOffset = yearTime - minTime;
        // We'll position it in the base coordinate space (scale=1) first.
        const pos = (timeOffset / timeRange) * containerWidth;
        const marker = document.createElement('div');
        marker.className = 'marker major';
        marker.style.left = `${pos}px`;
        marker.textContent = year;
        timelineBar.appendChild(marker);
    }

    // Place events.
    events.forEach((event, index) => {
        const dateStr = event.date;
        // Only place if it's a mm/dd/yyyy format.
        if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) return;
        // Position in base coordinate space.
        const timeOffset = event.timestamp - minTime;
        let pos = (timeOffset / timeRange) * containerWidth;
        // We ensure events are at least a minimal distance apart.
        if (pos - lastPos < 20) {
            pos = lastPos + 20;
        }
        lastPos = pos;

        const bubble = document.createElement('div');
        bubble.className = `event-bubble ${event.location ? 'has-location' : ''} ${index % 2 === 0 ? 'above' : 'below'}`;
        bubble.style.left = `${pos}px`;
        bubble.innerHTML = `<span class="event-number">${index + 1}</span>`;
        bubble.addEventListener('click', () => {
            const eventItem = document.querySelector(`.event-item[data-event-index="${event.index}"]`);
            if (eventItem) expandAndScrollToEvent(eventItem);
            if (event.marker) {
                map.setView(event.marker.getLatLng(), 10);
                event.marker.openPopup();
            }
        });

        const label = document.createElement('div');
        label.className = `event-label ${index % 2 === 0 ? 'above' : 'below'}`;
        label.style.left = `${pos}px`;
        // Format date label M/D.
        const [month, day] = dateStr.split('/').map(Number);
        label.textContent = `${month}/${day}`;

        timelineBar.appendChild(bubble);
        timelineBar.appendChild(label);
    });

    // Determine final width used by the timeline in base scale.
    let fullWidth = lastPos + 40; // Some extra padding.
    // Set timelineBar's base width.
    timelineBar.style.width = fullWidth + 'px';

    // Decide how much to scale horizontally to:
    // (1) Fit entire timeline in container at default zoom,
    // (2) or apply user zoom if present.
    let fitScale = 1;
    if (fullWidth > containerWidth + 1) {
        fitScale = containerWidth / fullWidth;
    }

    const userScale = zoomScales[zoomLevel - 1];
    timelineScale = fitScale * userScale;

    // Apply scale.
    timelineBar.style.transformOrigin = 'left center';
    timelineBar.style.transform = `scaleX(${timelineScale})`;
}

function expandAndScrollToEvent(eventItem) {
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

// Sidebar resize
const sidebar = document.getElementById('sidebar');
const resizeHandle = document.querySelector('.resize-handle');
let isResizing = false;

resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    e.preventDefault();
    const mainContentRect = document.getElementById('main-content').getBoundingClientRect();
    const newWidth = Math.max(10, Math.min(50, (e.clientX - mainContentRect.left) / mainContentRect.width * 100));
    sidebar.style.flexBasis = `${newWidth}%`;
    map.invalidateSize();
});

document.addEventListener('mouseup', () => {
    isResizing = false;
});
