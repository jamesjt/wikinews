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

// MarkerClusterGroup with custom behavior
const markers = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 40,
    disableClusteringAtZoom: 15
});
map.addLayer(markers);

let events = [];
let focusedEvent = null;
let currentView = 'map'; // Default view
let csvData = null;
let isClearingFocus = false; // Flag to prevent recursion

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
                    const locationName = row['Location Name']?.trim() || '';
                    const documentNames = row['Document Name']?.split(',').map(name => name.trim()) || [];
                    const documentLinks = row['Document Link']?.split(',').map(link => link.trim()) || [];
                    const linkNames = row['Link Name']?.split(',').map(name => name.trim()) || [];
                    const links = row['Links']?.split(',').map(link => link.trim()) || [];
                    const videoLinks = row['Video']?.split(',').map(link => link.trim()).filter(link => link) || [];
                    const imageUrl = row['Image']?.trim() || '';
                    const twitter = row['Twitter']?.trim() || '';
                    const podcast = row['Podcast']?.trim() || '';

                    // Add raw data fields for List view
                    const videoRaw = row['Video']?.trim() || '';
                    const imageRaw = row['Image']?.trim() || '';
                    const linksRaw = row['Links']?.trim() || '';
                    const documentLinkRaw = row['Document Link']?.trim() || '';

                    // Compute formattedDate for graph view
                    let formattedDate = dateStr;
                    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
                        const [month, day, year] = dateStr.split('/').map(Number);
                        const fullMonths = [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ];
                        const getOrdinal = (day) => {
                            if (day > 3 && day < 21) return `${day}th`;
                            switch (day % 10) {
                                case 1: return `${day}st`;
                                case 2: return `${day}nd`;
                                case 3: return `${day}rd`;
                                default: return `${day}th`;
                            }
                        };
                        formattedDate = `${fullMonths[month - 1]} ${getOrdinal(day)}, ${year}`;
                    }

                    // Compute displayDate for sidebar
                    let displayDate = dateStr;
                    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
                        const [month, day, year] = dateStr.split('/').map(Number);
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const getOrdinal = (day) => {
                            if (day > 3 && day < 21) return `${day}th`;
                            switch (day % 10) {
                                case 1: return `${day}st`;
                                case 2: return `${day}nd`;
                                case 3: return `${day}rd`;
                                default: return `${day}th`;
                            }
                        };
                        displayDate = `${months[month - 1]} ${getOrdinal(day)}`;
                    }

                    const validDocuments = [];
                    for (let i = 0; i < Math.min(documentNames.length, documentLinks.length); i++) {
                        const name = documentNames[i];
                        const link = documentLinks[i];
                        if (name && name.trim() !== '' && link && link.trim() !== '') {
                            validDocuments.push({ name, link });
                        }
                    }

                    const validLinks = [];
                    for (let i = 0; i < Math.min(linkNames.length, links.length); i++) {
                        const name = linkNames[i];
                        const link = links[i];
                        if (name && name.trim() !== '' && link && link.trim() !== '') {
                            validLinks.push({ name, link });
                        }
                    }

                    const videoEmbeds = videoLinks.map(link => {
                        if (link.includes('embed/')) {
                            return `<iframe width="100%" height="100%" src="${link}" frameborder="0" allowfullscreen></iframe>`;
                        } else if (link.includes('youtube.com') || link.includes('youtu.be')) {
                            const videoId = link.split('v=')[1]?.split('&')[0] || link.split('/').pop();
                            if (videoId) {
                                return `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
                            }
                        }
                        return '';
                    }).filter(embed => embed);

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

                            let popupContent = `
                                <div class="popup-text">
                                    <span class="popup-event-date">${dateStr}</span><br>
                                    <span class="popup-short-summary">${shortSummary}</span><br>
                                    <span class="popup-blurb">${blurb}</span>
                                </div>
                            `;

                            if (imageUrl) {
                                popupContent += `<br><img src="${imageUrl}" class="clickable-image" alt="Event Image">`;
                            }
                            if (videoEmbeds.length > 0) {
                                const videoHtml = videoEmbeds.map(embed => `<div class="video-container">${embed}</div>`).join('');
                                popupContent += `${videoHtml}`;
                            }
                            if (validLinks.length > 0) {
                                popupContent += `<div class="popup-links">`;
                                validLinks.forEach(linkObj => {
                                    popupContent += `
                                        <div class="link-entry">
                                            <img src="icon-link.png" alt="Link">
                                            <a href="${linkObj.link}" target="_blank">${linkObj.name}</a>
                                        </div>`;
                                });
                                popupContent += `</div>`;
                            }
                            if (validDocuments.length > 0) {
                                popupContent += `<div class="popup-documents">`;
                                validDocuments.forEach(doc => {
                                    popupContent += `
                                        <div class="document-link">
                                            <img src="icon-document.png" alt="Document">
                                            <a href="${doc.link}" target="_blank">${doc.name}</a>
                                        </div>`;
                                });
                                popupContent += `</div>`;
                            }

                            marker = L.marker(location, { icon: numberedIcon });
                            marker.eventIndex = index;
                            marker.bindPopup(popupContent, { maxWidth: 320 });

                            marker.on('popupopen', () => {
                                const event = events[marker.eventIndex];
                                setFocusedEvent(event);
                            });

                            marker.on('popupclose', () => {
                                if (!isClearingFocus) {
                                    clearFocusedEvent();
                                }
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
                        documentLinks,
                        videoEmbeds,
                        imageUrl,
                        validDocuments,
                        validLinks,
                        displayDate,
                        formattedDate,
                        locationName,
                        twitter,
                        podcast,
                        videoRaw,
                        imageRaw,
                        linksRaw,
                        documentLinkRaw
                    };
                }).filter(event => event.timestamp);

                console.log('Processed events:', events);
                buildSidebar(events);
                setupD3Timeline();
            }
        });
    })
    .catch(error => console.error('Error fetching CSV:', error));

// D3 timeline global variables
let svg, g, gX, eventGroup, circles, xScale, height, margin;

function setupD3Timeline() {
    const timelineDiv = document.getElementById('timeline');
    timelineDiv.innerHTML = '';

    height = 120;
    margin = { top: 20, right: 20, bottom: 20, left: 20 };

    svg = d3.select('#timeline')
        .append('svg')
        .attr('height', height)
        .attr('width', '100%');

    g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const minTime = d3.min(events, d => d.timestamp);
    const maxTime = d3.max(events, d => d.timestamp);
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000;

    xScale = d3.scaleTime()
        .domain([new Date(minTime - oneYearInMs), new Date(maxTime + oneYearInMs)])
        .range([0, timelineDiv.clientWidth - margin.left - margin.right]);

    const xAxis = d3.axisBottom(xScale)
        .ticks(d3.timeYear.every(1))
        .tickFormat(d3.timeFormat('%Y'));

    const axisYPosition = (height - margin.top - margin.bottom) / 2;
    gX = g.append('g')
        .attr('class', 'axis axis--x')
        .attr('transform', `translate(0,${axisYPosition})`)
        .call(xAxis);

    eventGroup = g.append('g')
        .attr('class', 'event-group');

    circles = eventGroup.selectAll('.event-circle')
        .data(events)
        .enter()
        .append('circle')
        .attr('class', 'event-circle')
        .attr('cx', d => xScale(d.timestamp))
        .attr('cy', (d, i) => (i % 2 === 0 ? axisYPosition - 20 : axisYPosition + 30))
        .attr('r', 8)
        .attr('fill', d => d.location ? 'rgba(33, 150, 243, 0.7)' : 'rgba(76, 175, 80, 0.7)')
        .attr('stroke', d => d.location ? '#2196F3' : '#4CAF50')
        .attr('stroke-width', 2)
        .on('click', (event, d) => setFocusedEvent(d))
        .on('mouseover', function(event, d) {
            d3.select(this).transition().duration(200).attr('r', 10);

            let iconsHtml = '';
            if (d.imageUrl) {
                iconsHtml += `<img src="icon-picture.png" alt="Image" width="16" height="16">`;
            }
            if (d.videoEmbeds.length > 0) {
                iconsHtml += `<img src="icon-video.png" alt="Video" width="16" height="16">`;
            }
            if (d.validLinks.length > 0) {
                iconsHtml += `<img src="icon-link.png" alt="Links" width="16" height="16">`;
            }
            if (d.validDocuments.length > 0) {
                iconsHtml += `<img src="icon-document.png" alt="Document" width="16" height="16">`;
            }

            d3.select('body').append('div')
                .attr('class', 'dynamic-tooltip')
                .style('position', 'absolute')
                .html(`<b>${d.shortSummary}</b><br>${d.date}<br><div class="icons">${iconsHtml}</div>`)
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
        .attr('y', (d, i) => (i % 2 === 0 ? axisYPosition - 16 : axisYPosition + 34))
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .style('pointer-events', 'none')
        .text(d => d.index + 1);

    const zoom = d3.zoom()
        .scaleExtent([0.1, 50])
        .translateExtent([[0, 0], [timelineDiv.clientWidth - margin.left - margin.right, height - margin.top - margin.bottom]])
        .wheelDelta((event) => -event.deltaY * 0.002)
        .on('zoom', (event) => {
            const transform = event.transform;
            const newXScale = transform.rescaleX(xScale);
            gX.call(xAxis.scale(newXScale));
            circles.attr('cx', d => newXScale(d.timestamp));
            eventGroup.selectAll('.event-number').attr('x', d => newXScale(d.timestamp));
        });

    svg.call(zoom).call(zoom.transform, d3.zoomIdentity);
    window.zoomBehavior = zoom;

    svg.on('dblclick.zoom', null);
    svg.on('dblclick', () => svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity));
}

function updateTimeline() {
    const timelineDiv = document.getElementById('timeline');
    const width = timelineDiv.clientWidth;

    xScale.range([0, width - margin.left - margin.right]);

    gX.call(d3.axisBottom(xScale));
    circles.attr('cx', d => xScale(d.timestamp));
    eventGroup.selectAll('.event-number').attr('x', d => xScale(d.timestamp));

    window.zoomBehavior.translateExtent([[0, 0], [width - margin.left - margin.right, height - margin.top - margin.bottom]]);
    svg.call(window.zoomBehavior);
}

setupD3Timeline();
updateTimeline();

window.addEventListener('resize', updateTimeline);

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
        event.displayDate = displayDate; // Ensure displayDate is set
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
                const eventContainer = document.createElement('div');
                eventContainer.className = 'event-container';

                const stateIcons = document.createElement('div');
                stateIcons.className = 'state-icons';
                const icons = ['–', '☰', '¶'];
                icons.forEach((icon, idx) => {
                    const stateIcon = document.createElement('div');
                    stateIcon.className = `state-icon ${event.summaryState === idx ? 'active' : ''}`;
                    stateIcon.textContent = icon;
                    stateIcon.addEventListener('click', () => {
                        event.summaryState = idx;
                        const eventItem = eventContainer.querySelector('.event-item');
                        eventItem.querySelector('.event-summary').textContent = [event.shortSummary, event.summary, event.blurb][idx];
                        stateIcons.querySelectorAll('.state-icon').forEach((si, i) => {
                            si.classList.toggle('active', i === idx);
                        });
                    });
                    stateIcons.appendChild(stateIcon);
                });

                const eventItem = document.createElement('div');
                eventItem.className = 'event-item';
                eventItem.setAttribute('data-event-index', event.index);

                const validDocumentNames = event.documentNames.filter(name => name && name.trim() !== '');
                const validDocumentLinks = event.documentLinks.filter(link => link && link.trim() !== '');
                const hasValidDocuments = validDocumentNames.length > 0 && validDocumentLinks.length > 0;

                const imageHtml = event.imageUrl ? `<img src="${event.imageUrl}" class="clickable-image" alt="Event Image">` : '';
                const videoHtml = event.videoEmbeds && event.videoEmbeds.length > 0
                    ? event.videoEmbeds.map(embed => `<div class="video-container">${embed}</div>`).join('')
                    : '';

                eventItem.innerHTML = `
                    <div class="event-date">
                        <span class="event-number-circle${event.location ? ' has-location' : ''}">${event.index + 1}</span>
                        <span>${event.displayDate}</span>
                        <div class="icons-container">
                            ${
                                event.validLinks.length > 0
                                    ? `<div class="link-wrapper"><div class="link-icon"><img src="icon-link.png" alt="Links"></div><div class="link-tooltip">${event.validLinks
                                          .map(
                                              linkObj =>
                                                  `<div class="link-entry"><img src="icon-link.png" alt="Link"><a href="${linkObj.link}" target="_blank">${linkObj.name}</a></div>`
                                          )
                                          .join('')}</div></div>`
                                    : ''
                            }
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
                    ${imageHtml}
                    ${videoHtml}
                `;

                const linkWrapper = eventItem.querySelector('.link-wrapper');
                const documentWrapper = eventItem.querySelector('.document-wrapper');

                if (linkWrapper) {
                    const linkTooltip = linkWrapper.querySelector('.link-tooltip');
                    linkWrapper.addEventListener('mouseenter', () => {
                        linkTooltip.style.display = 'block';
                    });
                    linkWrapper.addEventListener('mouseleave', () => {
                        linkTooltip.style.display = 'none';
                    });
                }

                if (documentWrapper) {
                    const documentTooltip = documentWrapper.querySelector('.document-tooltip');
                    documentWrapper.addEventListener('mouseenter', () => {
                        documentTooltip.style.display = 'block';
                    });
                    documentWrapper.addEventListener('mouseleave', () => {
                        documentTooltip.style.display = 'none';
                    });
                }

                eventItem.querySelector('.event-summary').addEventListener('click', () => {
                    event.summaryState = (event.summaryState + 1) % 3;
                    eventItem.querySelector('.event-summary').textContent = [event.shortSummary, event.summary, event.blurb][event.summaryState];
                    stateIcons.querySelectorAll('.state-icon').forEach((si, i) => {
                        si.classList.toggle('active', i === event.summaryState);
                    });
                });

                if (event.location) {
                    eventItem.querySelector('.location-icon').addEventListener('click', () => {
                        handleLocationClick(event);
                    });
                }
                eventItem.addEventListener('click', () => {
                    setFocusedEvent(event);
                });

                eventContainer.appendChild(stateIcons);
                eventContainer.appendChild(eventItem);
                eventDiv.appendChild(eventContainer);
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

    const sidebar = document.getElementById('sidebar');
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('sticky-active');
                } else {
                    entry.target.classList.remove('sticky-active');
                }
            });
        },
        {
            root: sidebar,
            threshold: 0,
            rootMargin: '0px 0px -100% 0px'
        }
    );

    document.querySelectorAll('.year .toggle').forEach(toggle => {
        observer.observe(toggle);
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

function setFocusedEvent(event) {
    if (focusedEvent === event) return; // Avoid re-focusing the same event

    clearFocusedEvent();
    focusedEvent = event;

    highlightTimelineBubble(event.index, true);

    const eventItem = document.querySelector(`.event-item[data-event-index="${event.index}"]`);
    if (eventItem) {
        expandAndScrollToEvent(eventItem);
        eventItem.classList.add('focused');
    }

    if (currentView === 'map' && event.marker) {
        handleLocationClick(event);
    } else if (currentView === 'graph') {
        scrollToGraphEvent(event.index);
        highlightGraphEvent(event.index, true);
    }
}

function clearFocusedEvent() {
    if (isClearingFocus || !focusedEvent) return;
    isClearingFocus = true;

    highlightTimelineBubble(focusedEvent.index, false);
    const eventItem = document.querySelector(`.event-item[data-event-index="${focusedEvent.index}"]`);
    if (eventItem) {
        eventItem.classList.remove('focused');
    }
    if (currentView === 'map' && focusedEvent.marker) {
        focusedEvent.marker.closePopup();
    }
    if (currentView === 'graph') {
        highlightGraphEvent(focusedEvent.index, false);
    }
    focusedEvent = null;
    isClearingFocus = false;
}

function scrollToGraphEvent(index) {
    const eventRow = document.querySelector(`.event-row[data-event-index="${index}"]`);
    if (eventRow) {
        eventRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function highlightGraphEvent(index, highlight) {
    const eventRow = document.querySelector(`.event-row[data-event-index="${index}"]`);
    if (eventRow) {
        if (highlight) {
            eventRow.classList.add('focused');
        } else {
            eventRow.classList.remove('focused');
        }
    }
}

function highlightTimelineBubble(eventIndex, highlight) {
    eventGroup.selectAll('.event-circle')
        .filter(d => d.index === eventIndex)
        .attr('fill', highlight ? 'orange' : (d => d.location ? 'rgba(33, 150, 243, 0.7)' : 'rgba(76, 175, 80, 0.7)'));
}

function handleLocationClick(event) {
    if (event.marker) {
        const latLng = event.marker.getLatLng();
        const desiredZoom = 10; // Set zoom level to 10 for a wider view
        map.setView(latLng, desiredZoom); // Center map on event location with specified zoom

        const cluster = markers.getVisibleParent(event.marker);
        if (cluster && cluster !== event.marker) {
            // If marker is in a cluster, expand it
            cluster.spiderfy();
            setTimeout(() => {
                event.marker.openPopup();
            }, 300); // Delay to allow cluster expansion
        } else {
            // If not in a cluster, open popup directly
            event.marker.openPopup();
        }
    }
}

function renderListView() {
    const listView = document.getElementById('list-view');
    if (!events || events.length === 0) {
        listView.innerHTML = 'Loading events...';
        return;
    }
    listView.innerHTML = ''; // Clear existing content

    events.forEach(event => {
        // Create event container
        const eventEntry = document.createElement('div');
        eventEntry.className = 'event-entry';

        // Event header with number and summary
        const eventHeader = document.createElement('div');
        eventHeader.className = 'event-header';

        const eventNumber = document.createElement('span');
        eventNumber.className = 'event-number';
        eventNumber.textContent = `Event ${event.index + 1}: `;

        const eventSummary = document.createElement('span');
        eventSummary.className = 'event-summary';
        eventSummary.textContent = event.shortSummary;

        eventHeader.appendChild(eventNumber);
        eventHeader.appendChild(eventSummary);
        eventEntry.appendChild(eventHeader);

        // Event details
        const eventDetails = document.createElement('div');
        eventDetails.className = 'event-details';

        const details = [
            { label: 'Video', data: event.videoRaw },
            { label: 'Image', data: event.imageRaw },
            { label: 'Links', data: event.linksRaw },
            { label: 'Document Link', data: event.documentLinkRaw }
        ];

        details.forEach(detail => {
            if (detail.data && detail.data.trim() !== '') {
                const detailElement = document.createElement('div');
                detailElement.className = 'event-detail';
                detailElement.textContent = `${detail.label}: ${detail.data}`;
                eventDetails.appendChild(detailElement);
            }
        });

        if (eventDetails.children.length > 0) {
            eventEntry.appendChild(eventDetails);
        }

        listView.appendChild(eventEntry);
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

    // View switching logic
    const mapBtn = document.querySelector('.view-btn[data-view="map"]');
    const graphBtn = document.querySelector('.view-btn[data-view="graph"]');
    const listBtn = document.querySelector('.view-btn[data-view="list"]');

    const mapView = document.getElementById('map');
    const graphView = document.getElementById('graph-view');
    const listView = document.getElementById('list-view');

    function switchView(view) {
        currentView = view;
        mapView.style.display = 'none';
        graphView.style.display = 'none';
        listView.style.display = 'none';

        mapBtn.classList.remove('active');
        graphBtn.classList.remove('active');
        listBtn.classList.remove('active');

        if (view === 'map') {
            mapView.style.display = 'block';
            mapBtn.classList.add('active');
            setTimeout(() => {
                map.invalidateSize();
                if (focusedEvent && focusedEvent.marker) {
                    handleLocationClick(focusedEvent);
                }
            }, 100); // Small delay to ensure the map is visible
        } else if (view === 'graph') {
            graphView.style.display = 'block';
            graphBtn.classList.add('active');
            if (events.length > 0) {
                renderAllEvents(events);
                if (focusedEvent) {
                    scrollToGraphEvent(focusedEvent.index);
                    highlightGraphEvent(focusedEvent.index, true);
                }
            } else {
                graphView.innerHTML = 'Loading events...';
            }
        } else if (view === 'list') {
            listView.style.display = 'block';
            listBtn.classList.add('active');
            renderListView();
        }
    }

    mapBtn.addEventListener('click', () => switchView('map'));
    graphBtn.addEventListener('click', () => switchView('graph'));
    listBtn.addEventListener('click', () => switchView('list'));
});

function createEventRow(event) {
    event.summaryState = 2; // Default to blurb

    const eventRow = document.createElement('div');
    eventRow.className = 'event-row';
    eventRow.setAttribute('data-event-index', event.index);
    eventRow.addEventListener('click', () => {
        setFocusedEvent(event);
    });

    // Main event column
    const eventMainWrapper = document.createElement('div');
    eventMainWrapper.className = 'event-main-wrapper';

    const eventMain = document.createElement('div');
    eventMain.className = 'event-main';

    const eventHeader = document.createElement('div');
    eventHeader.className = 'event-header';

    const eventNumber = document.createElement('span');
    eventNumber.className = `event-number-circle${event.location ? ' has-location' : ''}`;
    eventNumber.textContent = event.index + 1;

    const eventDate = document.createElement('span');
    eventDate.className = 'event-date-text';
    eventDate.textContent = event.formattedDate + (event.locationName ? ` - ${event.locationName}` : '');

    const stateIcons = document.createElement('div');
    stateIcons.className = 'state-icons state-icons-row';

    const icons = ['–', '☰', '¶']; // Short summary, summary, blurb
    icons.forEach((icon, idx) => {
        const stateIcon = document.createElement('div');
        stateIcon.className = `state-icon ${event.summaryState === idx ? 'active' : ''}`;
        stateIcon.textContent = icon;
        stateIcon.setAttribute('data-state', idx);
        stateIcon.addEventListener('click', () => {
            event.summaryState = idx;
            updateContent(event, eventContent);
            updateStateIcons(stateIcons, idx);
        });
        stateIcons.appendChild(stateIcon);
    });

    eventHeader.appendChild(eventNumber);
    eventHeader.appendChild(eventDate);
    eventHeader.appendChild(stateIcons);

    const eventContent = document.createElement('div');
    eventContent.className = 'event-content';
    updateContent(event, eventContent); // Set initial content

    eventMain.appendChild(eventHeader);
    eventMain.appendChild(eventContent);
    eventMainWrapper.appendChild(eventMain);

    // Corroboration column
    const corroborationColumn = document.createElement('div');
    corroborationColumn.className = 'corroboration-column';

    // Videos
    if (event.videoEmbeds && event.videoEmbeds.length > 0) {
        const videosSection = document.createElement('div');
        videosSection.className = 'videos-section';
        event.videoEmbeds.forEach(embed => {
            const videoItem = document.createElement('div');
            videoItem.className = 'video-item';
            videoItem.innerHTML = `
                <img src="icon-video.png" alt="Video" width="16" height="16" style="margin-right: 5px;">
                <div class="video-container">${embed}</div>
            `;
            videosSection.appendChild(videoItem);
        });
        corroborationColumn.appendChild(videosSection);
    }

    // Image
    if (event.imageUrl) {
        const imageSection = document.createElement('div');
        imageSection.className = 'image-section';
        imageSection.innerHTML = `
            <img src="icon-picture.png" alt="Image" width="16" height="16" style="margin-right: 5px;">
        `;
        const imgElement = document.createElement('img');
        imgElement.src = event.imageUrl;
        imgElement.className = 'event-image';
        imgElement.addEventListener('click', () => {
            const modal = document.createElement('div');
            modal.className = 'image-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.style.zIndex = '1000';
            const largeImg = document.createElement('img');
            largeImg.src = event.imageUrl;
            largeImg.style.maxWidth = '90%';
            largeImg.style.maxHeight = '90%';
            modal.appendChild(largeImg);
            modal.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            document.body.appendChild(modal);
        });
        imageSection.appendChild(imgElement);
        corroborationColumn.appendChild(imageSection);
    }

    // Links
    if (event.validLinks && event.validLinks.length > 0) {
        const linksSection = document.createElement('div');
        linksSection.className = 'links-section';
        event.validLinks.forEach(linkObj => {
            const linkElement = document.createElement('div');
            linkElement.className = 'link-item';
            linkElement.innerHTML = `
                <img src="icon-link.png" alt="Link" width="16" height="16" style="margin-right: 5px;">
                <a href="${linkObj.link}" target="_blank">${linkObj.name}</a>
            `;
            linksSection.appendChild(linkElement);
        });
        corroborationColumn.appendChild(linksSection);
    }

    // Documents
    if (event.validDocuments && event.validDocuments.length > 0) {
        const documentsSection = document.createElement('div');
        documentsSection.className = 'documents-section';
        event.validDocuments.forEach(doc => {
            const docElement = document.createElement('div');
            docElement.className = 'document-item';
            docElement.innerHTML = `
                <img src="icon-document.png" alt="Document" width="16" height="16" style="margin-right: 5px;">
                <a href="${doc.link}" target="_blank">${doc.name}</a>
            `;
            documentsSection.appendChild(docElement);
        });
        corroborationColumn.appendChild(documentsSection);
    }

    // Discussion column
    const discussionColumn = document.createElement('div');
    discussionColumn.className = 'discussion-column';

    // Twitter
    if (event.twitter) {
        const twitterSection = document.createElement('div');
        twitterSection.className = 'twitter-section';
        twitterSection.innerHTML = `
            <img src="icon-twitter.png" alt="Twitter" width="16" height="16" style="margin-right: 5px;">
            ${event.twitter}
        `;
        discussionColumn.appendChild(twitterSection);
    }

    // Podcast
    if (event.podcast) {
        const podcastSection = document.createElement('div');
        podcastSection.className = 'podcast-section';
        podcastSection.innerHTML = `
            <img src="icon-podcast.png" alt="Podcast" width="16" height="16" style="margin-right: 5px;">
            ${event.podcast}
        `;
        discussionColumn.appendChild(podcastSection);
    }

    // Assemble the row
    eventRow.appendChild(eventMainWrapper);
    eventRow.appendChild(corroborationColumn);
    eventRow.appendChild(discussionColumn);

    return eventRow;
}

function renderAllEvents(events) {
    const graphView = document.getElementById('graph-view');
    graphView.innerHTML = ''; // Clear previous content

    // Create sticky header
    const headerRow = document.createElement('div');
    headerRow.className = 'event-header-row';
    headerRow.innerHTML = `
        <div class="header-section events-header">Events</div>
        <div class="header-section corroboration-header">Corroboration</div>
        <div class="header-section discussion-header">Discussion</div>
    `;
    graphView.appendChild(headerRow);

    // Create and append each event row
    events.forEach(event => {
        const eventRow = createEventRow(event);
        graphView.appendChild(eventRow);
    });
}

function updateContent(event, eventContent) {
    const content = [event.shortSummary, event.summary, event.blurb][event.summaryState];
    eventContent.innerHTML = `<p>${content}</p>`;
}

function updateStateIcons(stateIcons, activeIdx) {
    stateIcons.querySelectorAll('.state-icon').forEach((icon, idx) => {
        icon.classList.toggle('active', idx === activeIdx);
    });
}

document.addEventListener('click', function(event) {
    if (event.target.classList.contains('clickable-image')) {
        event.target.classList.toggle('enlarged');
    }
});
