body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    height: 100vh;
    overflow: hidden; /* Prevent body scroll */
}

#main-content {
    display: flex;
    flex-direction: column;
    height: 100vh; /* Ensure it takes full viewport height */
}

header {
    background-color: #333;
    color: white;
    padding: 10px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0; /* Prevent header from shrinking */
}

.controls {
    display: flex;
    align-items: center;
    gap: 10px;
}

.controls label {
    margin-right: 5px;
}

.controls select, .controls button {
    padding: 5px 10px;
    font-size: 14px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.controls select {
    background-color: #fff;
    color: #333;
}

.controls button {
    background-color: #555;
    color: white;
    transition: background-color 0.3s;
}

.controls button:hover {
    background-color: #777;
}

.content-area {
    display: flex;
    flex: 1; /* Take remaining space */
    overflow: hidden;
}

#sidebar {
    width: 300px;
    min-width: 200px;
    max-width: 400px;
    background-color: #f4f4f4;
    overflow-y: auto;
    border-right: 1px solid #ccc;
    padding: 10px;
    flex: 0 0 300px;
}

#event-list .decade {
    margin-bottom: 10px;
}

#event-list .toggle {
    cursor: pointer;
    font-weight: bold;
    padding: 5px;
    background-color: #ddd;
    display: block;
}

#event-list .toggle.open .toggle-indicator {
    transform: rotate(90deg);
}

#event-list .decade-list, #event-list .year-list {
    display: none;
}

#event-list .decade-list.show, #event-list .year-list.show {
    display: block;
}

#event-list .year {
    margin-left: 20px;
}

.event-item {
    padding: 5px;
    cursor: pointer;
    border-bottom: 1px solid #eee;
}

.event-item:hover {
    background-color: #e0e0e0;
}

.event-date {
    display: flex;
    align-items: center;
    gap: 10px;
}

.event-number-circle {
    width: 20px;
    height: 20px;
    background-color: #4CAF50;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
}

.event-number-circle.has-location {
    background-color: #2196F3;
}

.icons-container {
    display: flex;
    gap: 5px;
}

.document-wrapper {
    position: relative;
}

.document-icon img {
    width: 16px;
    height: 16px;
    cursor: pointer;
}

.document-tooltip {
    display: none;
    position: absolute;
    background-color: white;
    border: 1px solid #ccc;
    padding: 5px;
    z-index: 1000;
    max-width: 200px;
    top: -100%;
    left: 50%;
    transform: translateX(-50%);
}

.document-wrapper:hover .document-tooltip {
    display: block;
}

.location-icon {
    width: 16px;
    height: 16px;
    cursor: pointer;
}

.map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
}

#map, #graph, #documents {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

#timeline {
    height: 120px;
    background-color: #fff;
    border-top: 1px solid #ccc;
    overflow: hidden;
    flex-shrink: 0; /* Prevent timeline from shrinking */
}

.resize-handle {
    width: 5px;
    background-color: #ccc;
    cursor: col-resize;
    height: 100%;
}

.dynamic-tooltip {
    position: absolute;
    background-color: white;
    border: 1px solid #ccc;
    padding: 5px;
    z-index: 1000;
    max-width: 200px;
}

/* Node details in graph */
.node-details {
    background-color: white;
    border: 1px solid #ccc;
    padding: 5px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    font-size: 12px;
    max-width: 180px;
}

/* Debugging styles */
.debug-header {
    border: 1px solid red;
}

.debug-content-area {
    border: 1px solid blue;
}

.debug-sidebar {
    border: 1px solid green;
}

.debug-map-container {
    border: 1px solid purple;
}

.debug-timeline {
    border: 1px solid orange;
}
