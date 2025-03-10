// script.js

/*
====================================
Enhancements:
1) Allows returning to the exact original "fit-to-container" scale if the user zooms.
   - The timeline now saves the initial scale on first load.
   - Pressing "-" repeatedly returns to that initial scale (the same view as on page load).
2) Adds click-and-drag panning of the timeline container.
   - The user can drag the timeline left or right.
====================================
*/

const defaultLocation = [50.45, 30.52];
const map = L.map('map').setView([48.3794, 31.1656], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

const markers = [];
let events = [];

// The discrete zoom levels that apply on top of the initial "fitted" scale.
let zoomLevel = 1;
const zoomScales = [1, 1.5, 2];

// We'll store the initial scale determined after the first population.
let baseScale = 1;
let firstPopulate = true;

// For timeline panning.
let isPanning = false;
let panStartX = 0;

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

                    // Only include the event if we can parse a valid mm/dd/yyyy date.
                    const isValidDate = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr);
                    return {
                        date: dateStr,
                        timestamp: isValidDate ? new Date(dateStr).getTime() : null,
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
                }).filter(event => event.timestamp);

                buildSidebar(events);
                populateTimeline();

                // Hook up zoom buttons and wheel.
                const timeline = document.getElementById('timeline');
                document.querySelector('.zoom-in').addEventListener('click', () => zoomTimeline(1));
                document.querySelector('.zoom-out').addEventListener('click', () => zoomTimeline(-1));
                timeline.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    zoomTimeline(e.deltaY < 0 ? 1 : -1);
                });

                // Add panning to timeline.
                timeline.addEventListener('mousedown', (e) => {
                    isPanning = true;
                    panStartX = e.pageX + timeline.scrollLeft;
                    e.preventDefault();
                });
                timeline.addEventListener('mousemove', (e) => {
                    if (!isPanning) return;
                    timeline.scrollLeft = panStartX - e.pageX;
                });
                timeline.addEventListener('mouseup', () => {
                    isPanning = false;
                });
                timeline.addEventListener('mouseleave', () => {
                    isPanning = false;
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
        decadeToggle.innerHTML = `<img class="toggle-indicator" src="icon-arrow-accordion.svg" alt="Toggle"> ${decade} <span class="event-count">${Object.values(groupedEvents[decade]).flat().length}</span>`;
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
                            ${
                                event.documentNames.length
                                    ? `<div class="document-wrapper"><div class="document-icon"><img src="icon-document.png" alt="Document"></div><div class="document-tooltip">${event.documentNames
                                          .map(
                                              (name, i) =>
                                                  `<div class="doc-entry"><img src="icon-document.png" alt="Document"><a href="${event.documentLinks[i]}" target="_blank">${name}</a></div>`
                                          )
                                          .join('')}</div></div>`
                                    : ''
                            }
                            ${event.location ? `<img class="location-icon" src="icon-location.svg" alt="Location">` : ''}
                        </div>
                    </div>
                    <div class="event-summary">${event.shortSummary}</div>
                `;
                // cycle through shortSummary, summary, blurb on click.
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

    if (!events.length) return;

    const minTime = Math.min(...events.map(e => e.timestamp));
    const maxTime = Math.max(...events.map(e => e.timestamp));
    const timeRange = maxTime - minTime;

    const timelineContainer = document.getElementById('timeline');
    // We'll allow some padding on sides.
    const containerWidth = timelineContainer.clientWidth - 40;

    // Sort events by timestamp.
    events.sort((a, b) => a.timestamp - b.timestamp);

    let lastPos = 0;

    // Add decade markers.
    const years = events
        .map(e => {
            const match = e.date.match(/\d{4}/);
            return match ? parseInt(match[0], 10) : null;
        })
        .filter(Boolean);
    if (!years.length) return;

    const startYear = Math.min(...years);
    const endYear = Math.max(...years);

    for (let year = Math.floor(startYear / 10) * 10; year <= endYear; year += 10) {
        const yearTime = new Date(`01/01/${year}`).getTime();
        const timeOffset = yearTime - minTime;
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
        if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) return;
        const timeOffset = event.timestamp - minTime;
        let pos = (timeOffset / timeRange) * containerWidth;

        // Force min gap of 20 px.
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
        const [month, day] = dateStr.split('/').map(Number);
        label.textContent = `${month}/${day}`;

        timelineBar.appendChild(bubble);
        timelineBar.appendChild(label);
    });

    const fullWidth = lastPos + 40;
    timelineBar.style.width = `${fullWidth}px`;

    // On first populate, store the scale needed to fit fully in container.
    if (firstPopulate) {
        if (fullWidth > containerWidth + 1) {
            baseScale = containerWidth / fullWidth;
        } else {
            baseScale = 1;
        }
        firstPopulate = false;
    }

    // The user-chosen zoom scale.
    const userScale = zoomScales[zoomLevel - 1];

    // Final scale is the product.
    const finalScale = baseScale * userScale;

    timelineBar.style.transformOrigin = 'left center';
    timelineBar.style.transform = `scaleX(${finalScale})`;
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

// Handle sidebar resize.
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
