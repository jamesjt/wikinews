// script.js

const defaultLocation = [50.45, 30.52];
const map = L.map('map').setView([48.3794, 31.1656], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

const markers = [];
let events = [];
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
                        timestamp: dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) ? new Date(dateStr).getTime() : null,
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

function populateTimeline() {
    const overviewBar = document.getElementById('overview-bar');
    const detailBar = document.getElementById('detail-bar');
    const focusWindow = document.getElementById('focus-window');
    const minTime = Math.min(...events.map(e => e.timestamp));
    const maxTime = Math.max(...events.map(e => e.timestamp));
    const timeRange = maxTime - minTime;
    const overviewWidth = overviewBar.parentElement.clientWidth * 2; // Double width for broad range
    overviewBar.style.width = `${overviewWidth}px`;

    // Aggregate events into clusters
    const clusters = {};
    const clusterWidth = overviewWidth / 50; // 50 clusters max
    events.forEach(event => {
        const pos = ((event.timestamp - minTime) / timeRange) * overviewWidth;
        const clusterKey = Math.floor(pos / clusterWidth);
        if (!clusters[clusterKey]) clusters[clusterKey] = [];
        clusters[clusterKey].push(event);
    });

    // Render overview clusters
    Object.entries(clusters).forEach(([key, cluster]) => {
        const clusterEl = document.createElement('div');
        clusterEl.className = 'event-cluster';
        clusterEl.style.left = `${key * clusterWidth}px`;
        clusterEl.style.width = `${clusterWidth}px`;
        clusterEl.title = `${cluster.length} events`;
        overviewBar.appendChild(clusterEl);
    });

    // Initial focus window (10% of timeline)
    const focusWidth = overviewWidth * 0.1;
    focusWindow.style.width = `${focusWidth}px`;
    let focusPos = 0;
    focusWindow.style.left = `${focusPos}px`;

    // Update detail view based on focus
    function updateDetailView() {
        detailBar.innerHTML = '';
        const detailWidth = detailBar.parentElement.clientWidth * 2;
        detailBar.style.width = `${detailWidth}px`;
        const focusStart = minTime + (focusPos / overviewWidth) * timeRange;
        const focusEnd = focusStart + (focusWidth / overviewWidth) * timeRange;
        const visibleEvents = events.filter(e => e.timestamp >= focusStart && e.timestamp <= focusEnd);

        visibleEvents.forEach((event, idx) => {
            const pos = ((event.timestamp - focusStart) / (focusEnd - focusStart)) * detailWidth;
            const eventEl = document.createElement('div');
            eventEl.className = `event-detail ${event.location ? 'has-location' : ''}`;
            eventEl.style.left = `${pos}px`;
            eventEl.style.width = `${Math.max(30, detailWidth / visibleEvents.length)}px`;
            eventEl.textContent = `${event.index + 1}`;
            eventEl.addEventListener('click', () => {
                const eventItem = document.querySelector(`.event-item[data-event-index="${event.index}"]`);
                if (eventItem) expandAndScrollToEvent(eventItem);
                if (event.marker) {
                    map.setView(event.marker.getLatLng(), 10);
                    event.marker.openPopup();
                }
            });
            eventEl.addEventListener('mouseover', (e) => {
                const tooltip = document.createElement('div');
                tooltip.className = 'event-tooltip';
                tooltip.textContent = `${event.date}: ${event.shortSummary}`;
                tooltip.style.left = `${e.clientX + 10}px`;
                tooltip.style.top = `${e.clientY + 10}px`;
                document.body.appendChild(tooltip);
                eventEl.addEventListener('mouseout', () => tooltip.remove(), { once: true });
            });
            detailBar.appendChild(eventEl);
        });
    }

    // Draggable focus window
    let isDragging = false;
    focusWindow.addEventListener('mousedown', () => isDragging = true);
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const overviewRect = overviewBar.parentElement.getBoundingClientRect();
        focusPos = Math.max(0, Math.min(e.clientX - overviewRect.left, overviewWidth - focusWidth));
        focusWindow.style.left = `${focusPos}px`;
        updateDetailView();
    });
    document.addEventListener('mouseup', () => {
        isDragging = false;
        updateDetailView();
    });

    // Initial render
    updateDetailView();
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

document.addEventListener('mouseup', () => isResizing = false);
