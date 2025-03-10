// script.js

const map = L.map('map', {
    zoomControl: true,
    zoomControlOptions: {
        position: 'bottomright'
    }
}).setView([48.3794, 31.1656], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

const markers = [];
let events = [];

let firstPopulate = true;

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
                                    popupContent += `
                                        <div class="document-link">
                                            <img src="icon-document.png" alt="Document">
                                            <a href="${documentLinks[i]}" target="_blank">${documentNames[i]}</a>
                                        </div>`;
                                }
                            }

                            marker = L.marker(location, { icon: numberedIcon })
                                .addTo(map)
                                .bindPopup(popupContent);

                            marker.on('click', () => {
                                const eventItem = document.querySelector(`.event-item[data-event-index="${index}"]`);
                                if (eventItem) expandAndScrollToEvent(eventItem);
                            });
                            markers.push(marker);
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

                buildSidebar(events);
                populateTimeline();

                window.addEventListener('resize', () => {
                    map.invalidateSize();
                    populateTimeline();
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

    let eventListHTML = '';
    sortedDecades.forEach(decade => {
        eventListHTML += `
            <div class="decade">
                <span class="toggle">
                    <img class="toggle-indicator" src="icon-arrow-accordion.svg" alt="Toggle"> ${decade}
                    <span class="event-count">${Object.values(groupedEvents[decade]).flat().length}</span>
                </span>
                <div class="decade-list">`;

        const sortedYears = Object.keys(groupedEvents[decade]).sort((a, b) => {
            if (a === 'Unknown') return 1;
            if (b === 'Unknown') return -1;
            return parseInt(a) - parseInt(b);
        });

        sortedYears.forEach(year => {
            eventListHTML += `
                <div class="year">
                    <span class="toggle">
                        <img class="toggle-indicator" src="icon-arrow-accordion.svg" alt="Toggle"> ${year}
                        <span class="event-count">${groupedEvents[decade][year].length}</span>
                    </span>
                    <div class="year-list">`;

            groupedEvents[decade][year].forEach(event => {
                const validDocumentNames = event.documentNames.filter(name => name && name.trim() !== '');
                const validDocumentLinks = event.documentLinks.filter(link => link && link.trim() !== '');
                const hasValidDocuments = validDocumentNames.length > 0 && validDocumentLinks.length > 0;

                eventListHTML += `
                    <div class="event-item" data-event-index="${event.index}">
                        <div class="event-date">
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
                        <div class="event-summary">${event.shortSummary}</div>
                    </div>`;
            });

            eventListHTML += `</div></div>`;
        });

        eventListHTML += `</div></div>`;
    });

    document.getElementById('event-list').innerHTML = eventListHTML;

    document.querySelectorAll('.toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const sublist = this.nextElementSibling;
            sublist.classList.toggle('show');
            this.classList.toggle('open');
        });
    });

    document.querySelectorAll('.event-summary').forEach((summary, index) => {
        summary.addEventListener('click', () => {
            const event = events[index];
            event.summaryState = (event.summaryState + 1) % 3;
            summary.textContent = [event.shortSummary, event.summary, event.blurb][event.summaryState];
        });
    });

    document.querySelectorAll('.location-icon').forEach((icon, index) => {
        icon.addEventListener('click', () => {
            const event = events[index];
            if (event.marker) {
                map.setView(event.marker.getLatLng(), 10);
                event.marker.openPopup();
            }
        });
    });
}

function populateTimeline() {
    const timelineBar = document.querySelector('.timeline-bar');
    timelineBar.innerHTML = '<div class="timeline-line"></div>';

    if (!events.length) return;

    const minTime = Math.min(...events.map(e => e.timestamp));
    const maxTime = Math.max(...events.map(e => e.timestamp));
    const timeRange = maxTime - minTime || 1;

    const virtualHeight = 10000;
    let lastPos = 0;
    const minGap = 50;

    events.sort((a, b) => a.timestamp - b.timestamp);

    const positions = events.map(event => {
        const timeOffset = event.timestamp - minTime;
        let pos = (timeOffset / timeRange) * virtualHeight;
        if (pos - lastPos < minGap) pos = lastPos + minGap;
        lastPos = pos;
        return pos;
    });

    const years = events
        .map(e => {
            const match = e.date.match(/\d{4}/);
            return match ? parseInt(match[0], 10) : null;
        })
        .filter(Boolean);
    if (years.length) {
        const startYear = Math.min(...years);
        const endYear = Math.max(...years);
        for (let year = Math.floor(startYear / 10) * 10; year <= endYear; year += 10) {
            const yearTime = new Date(`01/01/${year}`).getTime();
            const timeOffset = yearTime - minTime;
            let pos = (timeOffset / timeRange) * virtualHeight;
            const marker = document.createElement('div');
            marker.className = 'marker major';
            marker.style.top = `${pos}px`;
            marker.textContent = year;
            timelineBar.appendChild(marker);
        }
    }

    events.forEach((event, index) => {
        const pos = positions[index];
        const bubble = document.createElement('div');
        bubble.className = `event-bubble ${event.location ? 'has-location' : ''}`;
        bubble.style.top = `${pos}px`;
        bubble.innerHTML = `<span class="event-number">${event.index + 1}</span>`;
        bubble.addEventListener('click', () => {
            const eventItem = document.querySelector(`.event-item[data-event-index="${event.index}"]`);
            if (eventItem) expandAndScrollToEvent(eventItem);
            if (event.marker) {
                map.setView(event.marker.getLatLng(), 10);
                event.marker.openPopup();
            }
        });

        bubble.addEventListener('mouseover', (e) => {
            let tooltipContent = `<b>${event.shortSummary}</b><br>Date: ${event.date}`;
            if (event.documentNames.length && event.documentLinks.length) {
                for (let i = 0; i < Math.min(event.documentNames.length, event.documentLinks.length); i++) {
                    tooltipContent += `
                        <div class="document-link">
                            <img src="icon-document.png" alt="Document">
                            <a href="${event.documentLinks[i]}" target="_blank">${event.documentNames[i]}</a>
                        </div>`;
                }
            }
            const tooltip = document.createElement('div');
            tooltip.className = 'dynamic-tooltip';
            tooltip.innerHTML = tooltipContent;
            document.body.appendChild(tooltip);
            positionTooltip(tooltip, e.pageX, e.pageY);
        });
        bubble.addEventListener('mouseout', () => {
            document.querySelectorAll('.dynamic-tooltip').forEach(tooltip => tooltip.remove());
        });

        const label = document.createElement('div');
        label.className = `event-label ${index % 2 === 0 ? 'label-left' : 'label-right'}`;
        label.style.top = `${pos}px`;
        const [month, day] = event.date.split('/').map(Number);
        label.textContent = `${month}/${day}`;

        timelineBar.appendChild(bubble);
        timelineBar.appendChild(label);
    });

    const fullHeight = lastPos + 50;
    timelineBar.style.height = `${fullHeight}px`;
}

function positionTooltip(tooltip, mouseX, mouseY) {
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = mouseX + 10;
    let top = mouseY - tooltipHeight - 10;

    if (left + tooltipWidth > viewportWidth) left = mouseX - tooltipWidth - 10;
    if (top < 0) top = mouseY + 10;
    if (left < 0) left = 0;
    if (top + tooltipHeight > viewportHeight) top = viewportHeight - tooltipHeight - 10;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
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
    populateTimeline();
});

document.addEventListener('mouseup', () => isResizing = false);
