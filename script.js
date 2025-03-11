// script.js

const defaultLocation = [50.45, 30.52];
const map = L.map('map', {
    zoomControl: true,
    zoomControlOptions: {
        position: 'bottomright'
    }
}).setView([48.3794, 31.1656], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Replace markers array with MarkerClusterGroup
const markers = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 40
});
map.addLayer(markers);

let events = [];
let csvData = null;

fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSQ-JCv36Mjy1zwU8S2RR1OqROG3apZDAX6-iwyUW-UCONOinGuoIDa7retZv365QwHxWl_dmmUVMOy/pub?gid=183252261&single=true&output=csv')
    .then(response => response.text())
    .then(csvText => {
        console.log('CSV fetched successfully');
        csvData = csvText;
        Papa.parse(csvText, {
            header: true,
            complete: function(results) {
                console.log('Parsed CSV data:', results.data);
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
                                    popupContent += `
                                        <div class="document-link">
                                            <img src="icon-document.png" alt="Document">
                                            <a href="${documentLinks[i]}" target="_blank">${documentNames[i]}</a>
                                        </div>`;
                                }
                            }

                            marker = L.marker(location, { icon: numberedIcon })
                                .bindPopup(popupContent);

                            marker.on('click', () => {
                                marker.openPopup();
                            });

                            markers.addLayer(marker);
                        }
                    }

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

                console.log('Processed events:', events);
                buildSidebar(events);
                setupD3Timeline();
            }
        });
    })
    .catch(error => console.error('Error fetching CSV:', error));

function buildSidebar(events) {
    const groupedEvents = {};
    const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
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

                const validDocumentNames = event.documentNames.filter(name => name && name.trim() !== '');
                const validDocumentLinks = event.documentLinks.filter(link => link && link.trim() !== '');
                const hasValidDocuments = validDocumentNames.length > 0 && validDocumentLinks.length > 0;

                eventItem.innerHTML = `
                    <div class="event-date">
                        <div class="state-icons">
                            <span class="state-icon state-short ${event.summaryState === 0 ? 'active' : ''}" data-state="0">–</span>
                            <span class="state-icon state-long ${event.summaryState === 1 ? 'active' : ''}" data-state="1">☰</span>
                            <span class="state-icon state-blurb ${event.summaryState === 2 ? 'active' : ''}" data-state="2">¶</span>
                        </div>
                        <span class="event-number-circle${event.location ? ' has-location' : ''}">${event.index + 1}</span>
                        <span>${event.displayDate}</span>
                        <div class="icons-container">
                            ${
                                hasValidDocuments
                                    ? `<div class="document-wrapper"><div class="document-icon"><img src="icon-document.png" alt="Document"></div><div class="document-tooltip">${validDocumentNames
                                          .map(
                                              (name, i) =>
                                                  `<div class="doc-entry"><img src="icon-document.png" alt="Document"><a href="${validDocumentLinks[i]}" target="_blank">${name}</a></div>`
                                          )
                                          .join('')}</div></div>`
                                    : ''
                            }
                            ${event.location ? `<img class="location-icon" src="icon-location.svg" alt="Location">` : ''}
                        </div>
                    </div>
                    <div class="event-summary">${[event.shortSummary, event.summary, event.blurb][event.summaryState]}</div>
                `;

                // Add event listener for summary click to cycle states
                eventItem.querySelector('.event-summary').addEventListener('click', () => {
                    const newState = (event.summaryState + 1) % 3;
                    event.summaryState = newState;
                    eventItem.querySelector('.event-summary').textContent = [event.shortSummary, event.summary, event.blurb][newState];
                    const stateIcons = eventItem.querySelectorAll('.state-icon');
                    stateIcons.forEach(icon => {
                        const iconState = parseInt(icon.getAttribute('data-state'));
                        icon.classList.toggle('active', iconState === newState);
                    });
                });

                // Add event listeners for state icons to set specific state
                eventItem.querySelectorAll('.state-icon').forEach(icon => {
                    icon.addEventListener('click', () => {
                        const state = parseInt(icon.getAttribute('data-state'));
                        event.summaryState = state;
                        eventItem.querySelector('.event-summary').textContent = [event.shortSummary, event.summary, event.blurb][state];
                        const stateIcons = eventItem.querySelectorAll('.state-icon');
                        stateIcons.forEach(i => {
                            i.classList.toggle('active', parseInt(i.getAttribute('data-state')) === state);
                        });
                    });
                });

                // Location icon click handler
                if (event.location) {
                    eventItem.querySelector('.location-icon').addEventListener('click', () => {
                        handleLocationClick(event);
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

    // Toggle functionality for decade and year sections
    document.querySelectorAll('.toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const sublist = this.nextElementSibling;
            sublist.classList.toggle('show');
            this.classList.toggle('open');
        });
    });
}

function handleLocationClick(event) {
    if (event.marker) {
        map.setView(event.location, 10);
        event.marker.openPopup();
    }
}

function setupD3Timeline() {
    const timelineContainer = d3.select('.timeline-bar');
    const width = document.getElementById('timeline').offsetWidth;
    const height = 50;

    const svg = timelineContainer
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const timeExtent = d3.extent(events, d => d.timestamp);
    const xScale = d3.scaleTime()
        .domain(timeExtent)
        .range([10, width - 10]);

    const circles = svg.selectAll('circle')
        .data(events.filter(e => e.timestamp))
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.timestamp))
        .attr('cy', height / 2)
        .attr('r', 5)
        .attr('fill', d => d.location ? '#007bff' : '#28a745')
        .on('click', (event, d) => {
            if (d.marker) {
                map.setView(d.location, 10);
                d.marker.openPopup();
            }
            const eventItem = document.querySelector(`.event-item[data-event-index="${d.index}"]`);
            if (eventItem) eventItem.scrollIntoView({ behavior: 'smooth' });
        });

    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on('end', brushed);

    svg.append('g')
        .attr('class', 'brush')
        .call(brush);

    function brushed(event) {
        if (!event.selection) return;
        const [x0, x1] = event.selection;
        const timeRange = [xScale.invert(x0), xScale.invert(x1)];
        const filteredEvents = events.filter(e => e.timestamp >= timeRange[0] && e.timestamp <= timeRange[1]);
        buildSidebar(filteredEvents);
        markers.clearLayers();
        filteredEvents.forEach(e => {
            if (e.marker) markers.addLayer(e.marker);
        });
    }
}

// Sidebar resizing
const resizeHandle = document.querySelector('.resize-handle');
const sidebar = document.getElementById('sidebar');
let isResizing = false;

resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
});

document.addEventListener('mousemove', (e) => {
    if (isResizing) {
        const newWidth = e.clientX;
        if (newWidth >= 200 && newWidth <= 500) {
            sidebar.style.width = `${newWidth}px`;
        }
    }
});

document.addEventListener('mouseup', () => {
    isResizing = false;
});
