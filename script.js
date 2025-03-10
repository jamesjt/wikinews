// script.js

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const resizeHandle = document.querySelector('.resize-handle');
    let isResizing = false;

    // Start resizing on mousedown
    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        e.preventDefault(); // Prevent text selection
    });

    // Handle resizing on mousemove
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const container = document.getElementById('main-content');
        const containerRect = container.getBoundingClientRect();
        const newWidth = e.clientX - containerRect.left;

        // Enforce min and max widths from CSS
        const minWidth = parseInt(getComputedStyle(sidebar).minWidth);
        const maxWidth = parseInt(getComputedStyle(sidebar).maxWidth);
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            sidebar.style.flex = `0 0 ${newWidth}px`;
        }
    });

    // Stop resizing on mouseup
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
        }
    });
});
