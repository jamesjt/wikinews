// Define known locations with coordinates (latitude, longitude)
const locations = {
    "kyiv": [50.45, 30.52],
    "crimea": [45.3, 34.5],
    "donetsk": [48.0, 37.8],
    "kherson": [46.6354, 32.6169],
    "mariupol": [47.095, 37.541],
    "snake island": [45.255, 30.204],
    "kharkiv": [49.9935, 36.2304],
    "sudzha": [51.1833, 35.2667],
    "st. petersburg": [59.9343, 30.3351],
    "olenivka": [47.8333, 37.65],
    "makiivka": [48.0556, 37.9644],
    "soledar": [48.6833, 38.0667],
    "dnipro": [48.4647, 35.0462],
    "kramatorsk": [48.7386, 37.5844],
    "azovstal": [47.095, 37.541],
    "kerch strait bridge": [45.225, 36.615]
};

// Default location set to Kyiv
const defaultLocation = locations["kyiv"];

// Google Sheet public CSV URL
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSQ-JCv36Mjy1zwU8S2RR1OqROG3apZDAX6-iwyUW-UCONOinGuoIDa7retZv365QwHxWl_dmmUVMOy/pub?gid=183252261&single=true&output=csv';

// Initialize the Leaflet map
const map = L.map('map').setView([48.3794, 31.1656], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Array to store markers
const markers = [];

// Fetch events from Google Sheet CSV
fetch(SHEET_CSV_URL)
    .then(response => response.text())
    .then(csvText => {
        // Parse CSV using Papa Parse
        Papa.parse(csvText, {
            header: true, // Treat first row as headers
            complete: function(results) {
                // Debug: Log the headers and first few rows
                console.log('Parsed Headers:', results.meta.fields);
                console.log('Parsed Data Sample:', results.data.slice(0, 3));

                const events = results.data.map((row, index) => {
                    const dateStr = row['Date-MDY'] ? row['Date-MDY'].trim() : '';
                    if (!dateStr) {
                        console.warn('Missing date in row:', row);
                        return null; // Skip rows with no date
                    }
                    const description = row['Short Summary - Date'] ? row['Short Summary - Date'].trim() : '';
                    const locationStr = row['Location'] ? row['Location'].toLowerCase().trim() : '';
                    const location = locations[locationStr] || defaultLocation;

                    return {
                        date: dateStr, // Treat as string for display and timeline
                        description: description,
                        location: location,
                        story: 'The War in Ukraine',
                        index: index // Keep original order for timeline
                    };
                }).filter(event => event !== null);

                // No sorting by date since it's a string now
                // events.sort((a, b) => a.date - b.date); // Removed

                // Add markers to the map
                events.forEach(event => {
                    const marker = L.marker(event.location)
                        .addTo(map)
                        .bindPopup(`<b>${event.description}</b><br>Commentary: <a href="#">Link</a>`);
                    markers.push(marker);
                });

                // Populate sidebar
                populateSidebar(events);

                // Populate timeline
                populateTimeline(events);
            },
            error: function(error) {
                console.error('Papa Parse error:', error);
            }
        });
    })
    .catch(error => {
        console.error('Error fetching CSV:', error);
    });

// Commented out original eventLines approach
/*
const eventLines = `
February 9, 1990: Baker-Gorbachev talk: NATO won't expand eastward.
February 9, 1990: Baker-Gorbachev talk: NATO won't expand eastward.
February 12, 1990: Stepanov-Mamaladze notes: Germany in NATO, no eastward expansion.
July 16, 1990: Ukraine declares independence, renounces nuclear weapons.
December 1, 1991: Ukraine votes independence, Kravchuk elected.
October 19, 1993: White House outlines two-track NATO policy.
October 22, 1993: Yeltsin meets Christopher on NATO expansion.
January 10, 1994: Clinton announces Partnership for Peace.
January 14, 1994: Kravchuk, Yeltsin, Clinton sign nuclear deal.
June 28, 1996: Ukraine adopts constitution, no foreign bases.
April 24, 1997: Ukraine-NATO Distinctive Partnership signed.
May 27, 1997: NATO-Russia Founding Act signed.
May 29, 1997: Russia-Ukraine sign Black Sea Accords.
June 26, 1997: US policymakers oppose NATO expansion.
July 25, 1998: Putin becomes FSB head.
February 23, 1999: NATO proposes Rambouillet agreement to Serbia.
March 12, 1999: NATO expands to include Czech, Hungary, Poland.
March 24, 1999 - June 29, 1999: NATO's Operation Allied Force against Serbia.
September 1999: Putin: "We’ll whack ‘em" on Chechen separatists.
June 17, 2001: Bush-Putin meet in Slovenia, trust expressed.
September 11, 2001: US attacked, NATO invokes Article 5.
October 21, 2001: US plans to withdraw from ABM treaty.
November 10, 2001: Putin confused on ABM treaty termination.
November 13, 2001: Putin-Bush discuss Russia-NATO relations.
December 13, 2001: Bush announces ABM treaty withdrawal.
May 23, 2002: Ukraine bids for NATO entry.
May 24, 2002: US-Russia sign nuclear reduction treaty.
November 22, 2004: OSCE reports issues with Yanukovych election.
December 3, 2004: Ukrainian court annuls election, new vote.
December 11, 2004: Yushchenko treated for dioxin poisoning.
December 27, 2004: Yushchenko declares victory, Yanukovych contests.
July 2, 2007: Putin-Bush meet, discuss missile systems.
February 10, 2007: Putin's Munich speech criticizes NATO.
November 5, 2008: IMF approves $16.4B aid to Ukraine.
February 7-8, 2010: Yanukovych regains presidency.
April 27, 2010: Yanukovych signs Kharkiv Pact with Russia.
December 20, 2010: Tymoshenko charged with misspending.
June 24, 2011: Tymoshenko accused of gas case embezzlement.
August 17, 2011: Yushchenko testifies against Tymoshenko.
October 11, 2011: Tymoshenko convicted, 7 years sentence.
October 31, 2013: IMF: Ukraine needs to end energy subsidies.
November 21, 2013: Yanukovych suspends EU trade agreement, Maidan starts.
November 26, 2013: Tymoshenko hunger strike from jail.
November 29-December 1, 2013: Police break up demonstration, protests grow.
December 1, 2013: Politicians demand Yanukovych’s resignation.
December 8, 2013: Activists set up barricades.
December 12, 2013: EU reiterates Association Agreement offer.
December 13, 2013: Protesters topple Lenin statue.
December 22, 2013: McCain supports Maidan protesters.
January 28, 2014: Azarov resigns as PM.
February 4, 2014: Leaked Nuland-Pyatt call on Yanukovych’s exit.
February 20, 2014: Russia invades Crimea.
February 21, 2014: Yanukovych signs peace deal, flees.
February 28, 2014: Yanukovych flees, Tymoshenko freed.
March 18, 2014: Russia annexes Crimea.
March 20, 2014: US imposes sanctions on Russia.
February 2-3, 2016: US advisors train Ukrainian soldiers.
June 2016: EU strategy on Ukraine.
January 18, 2017: Biden at Davos links US illiberalism to Russia.
February 24, 2017: Lavrov denounces NATO.
April 23, 2021: Russia orders troop withdrawal after buildup.
September 1, 2021: Zelensky meets Biden, US aid announced.
November 17, 2021: Putin demands NATO remove post-1997 troops.
December 7, 2021: Biden-Putin video call on Ukraine.
December 30, 2021: Another Biden-Putin call.
January 23, 2022: US orders families from Kyiv embassy to leave.
January 24, 2022: US troops alert, NATO ships jets sent.
January 26, 2022: US and NATO deliver responses to Putin.
February 10, 2022: Russia-Belarus joint military exercises.
February 11, 2022: US and UK advise citizens to leave Ukraine.
February 24, 2022: Putin announces "special operation," invasion starts.
March 2, 2022: Russia captures Kherson.
March 16, 2022: Russia bombs Donetsk theatre in Mariupol.
March 29, 2022: Russia withdraws from Kyiv.
April 8, 2022: Russian missiles strike Kramatorsk train station.
May 16, 2022: Ukrainian forces surrender at Azovstal.
May 18, 2022: Finland and Sweden apply to join NATO.
June 30, 2022: Ukraine retakes Snake Island.
July 22, 2022: Ukraine-Russia sign grain export deal.
July 29, 2022: Missile strike on Olenivka prison, POWs killed.
September 6, 2022: Ukraine reclaims territory in Kharkiv counteroffensive.
September 30, 2022: Putin annexes four Ukrainian regions.
October 8, 2022: Ukraine destroys part of Kerch Strait Bridge.
November 9, 2022: Russia withdraws from Kherson.
December 21, 2022: Zelensky visits US, secures aid.
January 1, 2023: Ukrainian missile strike on Makiivka.
January 12, 2023: Russia captures Soledar.
January 14, 2023: Russian missile strikes Dnipro apartment.
February 20, 2023: Biden visits Kyiv, announces aid.
April 28, 2023: Russia launches large-scale missile attack.
June 23, 2023: Wagner's Prigozhin leads mutiny.
July 17, 2023: Russia pulls out of Black Sea grain deal.
August 23, 2023: Prigozhin dies in plane crash.
November 2, 2023: Ukraine hits Russian oil refineries.
November 25-26, 2023: Russia launches drone attack on Kyiv.
December 26, 2023: Ukraine destroys Russian warship in Crimea.
January 18, 2024: Ukrainian drones strike St. Petersburg oil depot.
January 25, 2024: Ukrainian missile downs Russian plane with POWs.
February 7, 2024: Russia launches offensive on Kyiv and other cities.
February 23, 2024: US and EU announce sanctions against Russia.
March 12-13, 2024: Ukraine conducts drone strikes on Russian oil refineries.
March 22, 2024: Russia attacks Ukrainian energy infrastructure.
April 5, 2024: Ukraine drone attack on Russian air base.
May 10, 2024: Russia captures territory north of Kharkiv.
August 14, 2024: Ukraine advances, captures Sudzha.
November 5, 2024: Donald Trump elected US president.
February 19, 2025: Trump posts on X about Zelensky.
February 28, 2025: Trump cancels minerals deal post-Zelenskiy clash.
`.trim().split('\n');

// Parse event lines into an array of event objects
const events = eventLines.map(line => {
    const [dateStr, ...descriptionParts] = line.split(': ');
    const description = descriptionParts.join(': ');
    const dateMatch = dateStr.match(/^[A-Za-z]+ \d{1,2}, \d{4}/);
    if (!dateMatch) {
        console.warn(`Invalid date format: ${dateStr}`);
        return null;
    }
    const date = new Date(dateMatch[0]);
    if (isNaN(date.getTime())) {
        console.warn(`Invalid date: ${dateMatch[0]}`);
        return null;
    }
    let location = defaultLocation;
    for (const loc in locations) {
        if (description.toLowerCase().includes(loc)) {
            location = locations[loc];
            break;
        }
    }
    return {
        date: date,
        location: location,
        description: description,
        story: 'The War in Ukraine'
    };
}).filter(event => event !== null);

// Sort events by date
events.sort((a, b) => a.date - b.date);
*/

// Populate sidebar with interactive list items
function populateSidebar(events) {
    const eventList = document.getElementById('event-list');
    eventList.innerHTML = '';
    events.forEach((event, index) => {
        const li = document.createElement('li');
        li.textContent = `${event.date}: ${event.description}`; // Use raw date string
        li.setAttribute('data-event-index', index);
        li.addEventListener('click', function() {
            const marker = markers[index];
            map.setView(marker.getLatLng(), 10);
            marker.openPopup();
        });
        eventList.appendChild(li);
    });
}

// Populate timeline with bubbles (position based on index)
function populateTimeline(events) {
    const timelineBar = document.querySelector('.timeline-bar');
    events.forEach((event, index) => {
        const position = (index / (events.length - 1)) * 100; // Evenly space based on order
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
