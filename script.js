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
let csvData = null;
let currentView = 'map'; // Track the current view

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
                    const linkNames = row['Link Name']?.split(',').map(name => name.trim()) || [];
                    const links = row['Links']?.split(',').map(link => link.trim()) || [];
                    const videoLinks = row['Video']?.split(',').map(link => link.trim()).filter(link => link) || [];
                    const imageUrl = row['Image']?.trim() || '';

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
                            return `<iframe width="280" height="157" src="${link}" frameborder="0" allowfullscreen></iframe>`;
                        } else if (link.includes('youtube.com') || link.includes('youtu.be')) {
                            const videoId = link.split('v=')[1]?.split('&')[0] || link.split('/').pop();
                            if (videoId) {
                                return `<iframe width="280" height="157" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
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
                                const eventIndex = marker.eventIndex;
                                const eventItem = document.querySelector(`.event-item[data-event-index="${eventIndex}"]`);
                                if (eventItem) {
                                    expandAndScrollToEvent(eventItem);
                                    eventItem.style.border = '5px solid #f9e9c3';
                                }
                                highlightTimelineBubble(eventIndex, true);
                            });

                            marker.on('popupclose', () => {
                                const eventIndex = marker.eventIndex;
                                const eventItem = document.querySelector(`.event-item[data-event-index="${eventIndex}"]`);
                                if (eventItem) {
                                    eventItem.style.border = '1px solid #eee';
                                }
                                highlightTimelineBubble(eventIndex, false);
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
                        validLinks
                    };
                }).filter(event => event.timestamp);

                console.log('Processed events:', events);
                buildSidebar(events);
                setupD3Timeline();
            }
        });
    })
    .catch(error => console.error('Error fetching CSV:', error));

// View switching function
function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelector(`#${view}-btn`).classList.add('active');
    document.querySelector(`#${view}`).classList.add('active');
    if (view === 'map') {
        map.invalidateSize(); // Ensure map resizes correctly
    } else if (view === 'graph' && !document.querySelector('#graph').dataset.initialized) {
        initGraph();
    }
}

// Event listeners for view buttons
document.querySelector('#map-btn').addEventListener('click', () => switchView('map'));
document.querySelector('#graph-btn').addEventListener('click', () => switchView('graph'));
document.querySelector('#docs-btn').addEventListener('click', () => switchView('docs'));

// Initialize Graph
function initGraph() {
    const graphDiv = document.querySelector('#graph');
    graphDiv.dataset.initialized = 'true';
    const width = graphDiv.clientWidth;
    const height = graphDiv.clientHeight;

    const svg = d3.select('#graph').append('svg')
        .attr('width', width)
        .attr('height', height);

    const nodes = [];
    const links = [];

    // Create main event nodes and connections
    events.forEach((event, i) => {
        nodes.push({ id: `event-${event.index}`, type: 'event', label: event.date, blurb: event.blurb });
        if (i > 0) {
            links.push({ source: `event-${events[i-1].index}`, target: `event-${event.index}`, type: 'main' });
        }

        // Sub-nodes for videos, docs, links, images
        const subTypes = ['video', 'doc', 'link', 'image'];
        subTypes.forEach(type => {
            const items = type === 'video' ? event.videoEmbeds :
                          type === 'doc' ? event.validDocuments :
                          type === 'link' ? event.validLinks :
                          type === 'image' ? (event.imageUrl ? [event.imageUrl] : []) : [];
            items.forEach((item, idx) => {
                const subId = `${type}-${event.index}-${idx}`;
                nodes.push({ 
                    id: subId, 
                    type, 
                    label: type === 'doc' || type === 'link' ? item.name : item 
                });
                links.push({ source: `event-${event.index}`, target: subId, type: 'sub' });
            });
        });
    });

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(d => d.type === 'main' ? 100 : 50))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('stroke', d => d.type === 'main' ? '#000' : '#999')
        .attr('stroke-width', d => d.type === 'main' ? 3 : 1);

    const node = svg.append('g')
        .selectAll('g')
        .data(nodes)
        .enter().append('g')
        .attr('class', 'node')
        .on('click', (event, d) => {
            if (d.type === 'event') {
                const eventIndex = parseInt(d.id.split('-')[1]);
                handleEventClick(events[eventIndex]);
            }
        });

    node.append('circle')
        .attr('r', 10)
        .attr('fill', d => d.type === 'event' ? '#007bff' : '#ccc');
    node.append('text')
        .attr('dy', -15)
        .attr('text-anchor', 'middle')
        .text(d => d.label);

    simulation.on('tick', () => {
        link.attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

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
        .on('click', (event, d) => handleEventClick(d))
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

window.addEventListener('resize', () => {
    updateTimeline();
    if (currentView === 'map') {
        map.invalidateSize();
    }
});

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
                    handleEventClick(event);
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

function handleEventClick(event) {
    const eventItem = document.querySelector(`.event-item[data-event-index="${event.index}"]`);
    if (eventItem) expandAndScrollToEvent(eventItem);
    if (event.marker && currentView === 'map') {
        handleLocationClick(event);
    }
}

function handleLocationClick(event) {
    if (event.marker) {
        const latLng = event.marker.getLatLng();
        map.panTo(latLng);
        if (markers.hasLayer(event.marker)) {
            markers.zoomToShowLayer(event.marker, () => {
                event.marker.openPopup();
            });
        } else {
            event.marker.openPopup();
        }
    }
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
            if (currentView === 'map') {
                map.invalidateSize();
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
        }
    });
});

function highlightTimelineBubble(eventIndex, highlight) {
    eventGroup.selectAll('.event-circle')
        .filter(d => d.index === eventIndex)
        .attr('fill', highlight ? 'orange' : (d => d.location ? 'rgba(33, 150, 243, 0.7)' : 'rgba(76, 175, 80, 0.7)'));
}

document.addEventListener('click', function(event) {
    if (event.target.classList.contains('clickable-image')) {
        event.target.classList.toggle('enlarged');
    }
});
