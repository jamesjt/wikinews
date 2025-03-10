/* styles.css */

/* ... existing styles remain above ... */

/* Add a tooltip for timeline bubbles */
.event-bubble {
    position: absolute;
    width: 16px;
    height: 16px;
    background: rgba(76, 175, 80, 0.7); /* Green with 70% opacity */
    border: 2px solid #4CAF50; /* Solid green border */
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.2s ease;
    transform: translateX(-50%);
    /* Keep existing lines, but we add a child tooltip */
}

.event-bubble.has-location {
    background: rgba(33, 150, 243, 0.7); /* Blue with 70% opacity */
    border: 2px solid #2196F3; /* Solid blue border */
}

.event-bubble:hover {
    transform: translateX(-50%) scale(1.2);
}

/* The hidden tooltip displayed on hover. */
.bubble-tooltip {
    display: none; /* Hidden by default */
    position: absolute;
    top: -70px; /* Place it above the bubble; adjust as needed */
    left: 50%;
    transform: translateX(-50%);
    min-width: 140px; /* Adjust to suit your content */
    max-width: 240px;
    background: #fff;
    border: 1px solid #ccc;
    padding: 6px;
    font-size: 12px;
    line-height: 1.4;
    border-radius: 3px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    z-index: 9999;
}

/* Show the tooltip on bubble hover. */
.event-bubble:hover .bubble-tooltip {
    display: block;
}

/* Make sure links inside bubble-tooltip appear normal */
.bubble-tooltip a {
    color: #1a73e8;
    text-decoration: none;
}
.bubble-tooltip a:hover {
    text-decoration: underline;
}
