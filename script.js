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
// let timelineLoaded = false; // Commented out for TimelineJS

/* BEGIN COMMENTED TIMELINEJS CODE
// Load TimelineJS library
const timelineScript = document.createElement('script');
timelineScript.src = 'https://cdn.knightlab.com/libs/timeline3/latest/js/timeline.js';
timelineScript.onload = () => {
    console.log('TimelineJS script loaded');
    timelineLoaded = true;
    if (csvData) {
        console.log('CSV data already available, initializing timeline');
        setupTimelineJS(csvData);
    } else {
        console.log('Waiting for CSV data to initialize timeline');
    }
};
timelineScript.onerror = () => console.error('Failed to load TimelineJS script');
document.head.appendChild(timelineScript);

// Load TimelineJS CSS
const timelineCSS = document.createElement('link');
timelineCSS.rel = 'stylesheet';
timelineCSS.href = 'https://cdn.knightlab.com/libs/timeline3/latest/css/timeline.css';
document.head.appendChild(timelineCSS);
END COMMENTED TIMELINEJS CODE */

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
                                const eventItem = document.querySelector(`.event-item[data-event-index="${index}"]`);
                                if (eventItem) expandAndScrollToEvent(eventItem);
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

/* BEGIN COMMENTED TIMELINEJS CODE
function setupTimelineJS(csvText) {
    console.log('Setting up TimelineJS with CSV:', csvText.substring(0, 100));
    const timelineData = {
        events: []
    };

    events.forEach((event, index) => {
        const [month, day, year] = event.date.split('/').map(num => parseInt(num, 10));
        let text = `<p>${event.summary}</p>`;
        if (event.documentNames.length && event.documentLinks.length) {
            text += '<div>';
            for (let i = 0; i < Math.min(event.documentNames.length, event.documentLinks.length); i++) {
                text += `<div class="document-link"><a href="${event.documentLinks[i]}" target="_blank">${event.documentNames[i]}</a></div>`;
            }
            text += '</div>';
        }

        timelineData.events.push({
            start_date: {
                month: month.toString(),
                day: day.toString(),
                year: year.toString()
            },
            text: {
                headline: event.shortSummary,
                text: text
            },
            unique_id: `event-${index}`
        });
    });

    console.log('TimelineJS data:', timelineData);

    if (typeof TL === 'undefined') {
        console.error('TimelineJS library not loaded yet');
        return;
    }

    try {
        const timeline = new TL.Timeline('timeline', timelineData, {
            height: 120,
            marker_height_min: 30,
            initial_zoom: 1
        });
        console.log('TimelineJS initialized');

        setTimeout(() => {
            const storySlider = document.querySelector('.tl-storyslider');
            if (storySlider) {
                storySlider.remove();
                console.log('Story slider removed from DOM');
            }
            const timeNav = document.querySelector('.tl-timenav');
            if (timeNav) {
                timeNav.style.height = '100%';
            }
        }, 100);

        timeline.on('change', (data) => {
            console.log('Timeline event changed:', data);
            const eventId = data.unique_id;
            if (eventId) {
                const index = parseInt(eventId.split('-')[1]);
                const eventItem = document.querySelector(`.event-item[data-event-index="${index}"]`);
                if (eventItem) {
                    expandAndScrollToEvent(eventItem);
                }
                const event = events[index];
                if (event && event.marker) {
                    map.setView(event.marker.getLatLng(), 10);
                    event.marker.openPopup();
                }
            }
        });
    } catch (e) {
        console.error('Error initializing TimelineJS:', e);
    }
}
END COMMENTED TIMELINEJS CODE */

function setupD3Timeline() {
    const timelineDiv = document.getElementById('timeline');
    timelineDiv.innerHTML = '';

    const width = timelineDiv.clientWidth - 40;
    const height = 120;
    const margin = { top: 20, right: 20, bottom: 30, left: 20 };

    const svg = d3.select('#timeline')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const minTime = d3.min(events, d => d.timestamp);
    const maxTime = d3.max(events, d => d.timestamp);
    let xScale = d3.scaleTime()
        .domain([minTime, maxTime])
        .range([0, width - margin.left - margin.right]);

    const xAxis = d3.axisBottom(xScale)
        .ticks(d3.timeYear.every(1))
        .tickFormat(d3.timeFormat('%Y'));

    const gX = svg.append('g')
        .attr('class', 'axis axis--x')
        .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
        .call(xAxis);

    const eventGroup = svg.append('g')
        .attr('class', 'event-group');

    const circles = eventGroup.selectAll('.event-circle')
        .data(events)
        .enter()
        .append('circle')
        .attr('class', 'event-circle')
        .attr('cx', d => xScale(d.timestamp))
        .attr('cy', height / 2 - margin.top)
        .attr('r', 8)
        .attr('fill', d => d.location ? 'rgba(33, 150, 243, 0.7)' : 'rgba(76, 175, 80, 0.7)')
        .attr('stroke', d => d.location ? '#2196F3' : '#4CAF50')
        .attr('stroke-width', 2)
        .on('click', (event, d) => {
            const eventItem = document.querySelector(`.event-item[data-event-index="${d.index}"]`);
            if (eventItem) expandAndScrollToEvent(eventItem);
            if (d.marker) {
                map.setView(d.marker.getLatLng(), 10);
                d.marker.openPopup();
            }
        })
        .on('mouseover', function(event, d) {
            d3.select(this).transition().duration(200).attr('r', 10);
            const tooltip = d3.select('body')
                .append('div')
                .attr('class', 'dynamic-tooltip')
                .style('position', 'absolute')
                .html(`<b>${d.shortSummary}</b><br>Date: ${d.date}`)
                .style('left', `${event.pageX + 20}px`)
                .style('top', `${event.pageY - 50}px`);
        })
        .on('mouseout', function() {
            d3.select(this).transition().duration(200).attr('r', 8);
            d3.selectAll('.dynamic-tooltip').remove();
        });

    eventGroup.selectAll('.event-number')
        .data(events)
        .enter()
        .append('text')
        .attr('class', 'event-number')
        .attr('x', d => xScale(d.timestamp))
        .attr('y', height / 2 - margin.top + 4)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .style('pointer-events', 'none')
        .text(d => d.index + 1);

    // Add zoom behavior with immediate response
    const zoom = d3.zoom()
        .scaleExtent([0.1, 20]) // Allow zooming out to 10% and in to 2000%
        .translateExtent([[0, 0], [width, height]]) // Limit panning to SVG bounds
        .on('zoom', (event) => {
            const transform = event.transform;
            const newXScale = transform.rescaleX(xScale);
            gX.call(xAxis.scale(newXScale));
            circles.attr('cx', d => newXScale(d.timestamp));
            eventGroup.selectAll('.event-number')
                .attr('x', d => newXScale(d.timestamp));
        });

    // Apply zoom to the SVG
    svg.call(zoom)
        .call(zoom.transform, d3.zoomIdentity); // Start at initial scale (1)

    // Optional: Double-click to reset zoom with smooth transition
    svg.on('dblclick.zoom', null); // Disable default double-click zoom
    svg.on('dblclick', () => {
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const resizeHandle = document.querySelector('.resize-handle');
    let isResizing = false;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const container = document.getElementById('main-content');
        const containerRect = container.getBoundingClientRect();
        const newWidth = e.clientX - containerRect.left;

        const minWidth = parseInt(getComputedStyle(sidebar).minWidth);
        const maxWidth = parseInt(getComputedStyle(sidebar).maxWidth);
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            sidebar.style.flex = `0 0 ${newWidth}px`;
            map.invalidateSize();
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
        }
    });
});

/* BEGIN COMMENTED ORIGINAL TIMELINE CODE
// We'll store the initial scale determined after the first population.
let baseScale = 1;
let firstPopulate = true;

// For timeline panning.
let isPanning = false;
let panStartX = 0;

function populateTimeline() {
    const timelineBar = document.querySelector('.timeline-bar');
    timelineBar.innerHTML = '<div class="timeline-line"></div>';

    if (!events.length) return;

    const minTime = Math.min(...events.map(e => e.timestamp));
    const maxTime = Math.max(...events.map(e => e.timestamp));
    const timeRange = maxTime - minTime;

    const timelineContainer = document.getElementById('timeline');
    const containerWidth = timelineContainer.clientWidth - 40;

    events.sort((a, b) => a.timestamp - b.timestamp);

    let lastPos = 0;

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

    events.forEach((event, index) => {
        const dateStr = event.date;
        if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) return;
        const timeOffset = event.timestamp - minTime;
        let pos = (timeOffset / timeRange) * containerWidth;

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

        bubble.addEventListener('mouseover', (e) => {
            let tooltipContent = `<b>${event.shortSummary}</b><br>Date: ${dateStr}`;
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

            const mouseX = e.pageX;
            const mouseY = e.pageY;
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;

            let left = mouseX + 10;
            let top = mouseY - tooltipHeight - 10;

            if (left + tooltipWidth > window.innerWidth) {
                left = mouseX - tooltipWidth - 10;
            }
            if (top < 0) {
                top = mouseY + 10;
            }
            if (left < 0) {
                left = 0;
            }

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        });

        bubble.addEventListener('mouseout', () => {
            const tooltips = document.querySelectorAll('.dynamic-tooltip');
            tooltips.forEach(tooltip => tooltip.remove());
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

    if (firstPopulate) {
        if (fullWidth > containerWidth + 1) {
            baseScale = containerWidth / fullWidth;
        } else {
            baseScale = 1;
        }
        firstPopulate = false;
    }

    const userScale = 1;
    const finalScale = baseScale * userScale;

    timelineBar.style.transformOrigin = 'left center';
    timelineBar.style.transform = `scaleX(${finalScale})`;
}

// Add panning to timeline (inside fetch callback)
const timeline = document.getElementById('timeline');
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

// Window resize event (inside fetch callback)
window.addEventListener('resize', () => {
    map.invalidateSize();
    populateTimeline();
});
END COMMENTED ORIGINAL TIMELINE CODE */
