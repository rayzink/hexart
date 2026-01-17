/**
 * HexCraft - Interactive Hex Art Creator
 * A progressive web application for creating hexagonal pixel art
 */

// ============================================================================
// Configuration & State
// ============================================================================

const CONFIG = {
    gridSize: 20,
    hexSize: 30,
    showGridLines: true,
    backgroundColor: '#0f0f23',
    gridLineColor: '#2a2a4a',
    maxHistorySteps: 50,
    soundEnabled: true
};

const STATE = {
    currentTool: 'draw',
    currentColor: '#6366f1',
    isDrawing: false,
    isPanning: false,
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    lastPanPosition: { x: 0, y: 0 },
    pinchDistance: 0,
    hexCells: new Map(),
    history: [],
    historyIndex: -1,
    recentColors: [],
    hoveredHex: null
};

// Preset color palette
const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
    '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    '#ffffff', '#e5e5e5', '#a3a3a3', '#737373',
    '#525252', '#404040', '#262626', '#171717'
];

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {};

function initElements() {
    elements.canvas = document.getElementById('hexCanvas');
    elements.ctx = elements.canvas.getContext('2d');
    elements.canvasContainer = document.getElementById('canvasContainer');
    elements.currentColor = document.getElementById('currentColor');
    elements.colorPicker = document.getElementById('colorPicker');
    elements.presetColors = document.getElementById('presetColors');
    elements.recentColors = document.getElementById('recentColors');
    elements.mobilePresetColors = document.getElementById('mobilePresetColors');
    elements.mobileColorPicker = document.getElementById('mobileColorPicker');
    elements.mobileColorPreview = document.querySelector('.mobile-color-preview');
    elements.undoBtn = document.getElementById('undoBtn');
    elements.redoBtn = document.getElementById('redoBtn');
    elements.clearBtn = document.getElementById('clearBtn');
    elements.downloadBtn = document.getElementById('downloadBtn');
    elements.soundToggle = document.getElementById('soundToggle');
    elements.settingsBtn = document.getElementById('settingsBtn');
    elements.settingsModal = document.getElementById('settingsModal');
    elements.closeSettings = document.getElementById('closeSettings');
    elements.zoomIn = document.getElementById('zoomIn');
    elements.zoomOut = document.getElementById('zoomOut');
    elements.zoomReset = document.getElementById('zoomReset');
    elements.zoomLevel = document.getElementById('zoomLevel');
    elements.gridSizeSlider = document.getElementById('gridSizeSlider');
    elements.gridSizeValue = document.getElementById('gridSizeValue');
    elements.hexSizeSlider = document.getElementById('hexSizeSlider');
    elements.hexSizeValue = document.getElementById('hexSizeValue');
    elements.showGridLines = document.getElementById('showGridLines');
    elements.bgColorPicker = document.getElementById('bgColorPicker');
    elements.applySettings = document.getElementById('applySettings');
    elements.toastContainer = document.getElementById('toastContainer');
    elements.installBanner = document.getElementById('installBanner');
    elements.installBtn = document.getElementById('installBtn');
    elements.dismissInstall = document.getElementById('dismissInstall');
    elements.mobileToolbar = document.getElementById('mobileToolbar');
    elements.mobileColorBtn = document.getElementById('mobileColorBtn');
    elements.mobileColorOverlay = document.getElementById('mobileColorOverlay');
    elements.closeMobileColor = document.getElementById('closeMobileColor');
    elements.mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    elements.mobileMenu = document.getElementById('mobileMenu');
    elements.mobileUndo = document.getElementById('mobileUndo');
    elements.mobileRedo = document.getElementById('mobileRedo');
    elements.mobileClear = document.getElementById('mobileClear');
    elements.mobileDownload = document.getElementById('mobileDownload');
    elements.mobileSoundToggle = document.getElementById('mobileSoundToggle');
    elements.collapseColors = document.getElementById('collapseColors');
    elements.colorPalette = document.getElementById('colorPalette');
}

// ============================================================================
// Audio System
// ============================================================================

class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
    }

    init() {
        if (this.audioContext) return;
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    playTone(frequency, duration = 0.05, type = 'sine', volume = 0.1) {
        if (!this.enabled || !this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    playDrawSound() {
        const frequencies = [440, 523, 587, 659, 698, 784, 880];
        const freq = frequencies[Math.floor(Math.random() * frequencies.length)];
        this.playTone(freq, 0.08, 'sine', 0.08);
    }

    playFillSound() {
        this.playTone(330, 0.15, 'triangle', 0.1);
        setTimeout(() => this.playTone(440, 0.15, 'triangle', 0.08), 50);
    }

    playEraseSound() {
        this.playTone(220, 0.08, 'sawtooth', 0.05);
    }

    playUndoSound() {
        this.playTone(392, 0.1, 'sine', 0.08);
        setTimeout(() => this.playTone(330, 0.1, 'sine', 0.06), 80);
    }

    playRedoSound() {
        this.playTone(330, 0.1, 'sine', 0.06);
        setTimeout(() => this.playTone(392, 0.1, 'sine', 0.08), 80);
    }

    playClearSound() {
        this.playTone(440, 0.2, 'square', 0.05);
        setTimeout(() => this.playTone(220, 0.3, 'square', 0.04), 100);
    }

    playClickSound() {
        this.playTone(800, 0.03, 'sine', 0.05);
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

const audio = new AudioSystem();

// ============================================================================
// Hexagon Grid System
// ============================================================================

class HexGrid {
    constructor() {
        this.hexWidth = 0;
        this.hexHeight = 0;
        this.verticalSpacing = 0;
        this.horizontalSpacing = 0;
    }

    updateDimensions(hexSize) {
        this.hexWidth = hexSize * 2;
        this.hexHeight = Math.sqrt(3) * hexSize;
        this.verticalSpacing = this.hexHeight;
        this.horizontalSpacing = this.hexWidth * 0.75;
    }

    // Get hex corners for drawing
    getHexCorners(centerX, centerY, size) {
        const corners = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            corners.push({
                x: centerX + size * Math.cos(angle),
                y: centerY + size * Math.sin(angle)
            });
        }
        return corners;
    }

    // Convert pixel coordinates to hex grid coordinates
    pixelToHex(x, y, hexSize, offset) {
        const adjustedX = (x - offset.x) / STATE.zoom;
        const adjustedY = (y - offset.y) / STATE.zoom;

        // Approximate column
        const col = Math.round(adjustedX / this.horizontalSpacing);

        // Calculate row, accounting for staggered layout
        const isOddCol = col % 2 !== 0;
        const rowOffset = isOddCol ? this.hexHeight / 2 : 0;
        const row = Math.round((adjustedY - rowOffset) / this.verticalSpacing);

        return { col, row };
    }

    // Convert hex grid coordinates to pixel center
    hexToPixel(col, row) {
        const x = col * this.horizontalSpacing;
        const isOddCol = col % 2 !== 0;
        const rowOffset = isOddCol ? this.hexHeight / 2 : 0;
        const y = row * this.verticalSpacing + rowOffset;
        return { x, y };
    }

    // Check if a point is inside a hexagon
    pointInHex(px, py, centerX, centerY, size) {
        const dx = Math.abs(px - centerX);
        const dy = Math.abs(py - centerY);

        if (dx > size || dy > this.hexHeight / 2) return false;

        return size * this.hexHeight / 2 - size / 2 * dy - this.hexHeight / 2 * dx >= 0;
    }

    // Get neighboring hex cells for flood fill
    getNeighbors(col, row) {
        const isOddCol = col % 2 !== 0;
        const neighbors = [
            { col: col + 1, row: isOddCol ? row : row - 1 },
            { col: col + 1, row: isOddCol ? row + 1 : row },
            { col: col - 1, row: isOddCol ? row : row - 1 },
            { col: col - 1, row: isOddCol ? row + 1 : row },
            { col: col, row: row - 1 },
            { col: col, row: row + 1 }
        ];
        return neighbors.filter(n =>
            n.col >= 0 && n.col < CONFIG.gridSize &&
            n.row >= 0 && n.row < CONFIG.gridSize
        );
    }
}

const hexGrid = new HexGrid();

// ============================================================================
// Canvas Rendering
// ============================================================================

function resizeCanvas() {
    const container = elements.canvasContainer;
    const rect = container.getBoundingClientRect();

    // Set canvas size to match container
    elements.canvas.width = rect.width * window.devicePixelRatio;
    elements.canvas.height = rect.height * window.devicePixelRatio;
    elements.canvas.style.width = rect.width + 'px';
    elements.canvas.style.height = rect.height + 'px';

    // Scale context for high DPI displays
    elements.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Center the grid
    const gridWidth = CONFIG.gridSize * hexGrid.horizontalSpacing;
    const gridHeight = CONFIG.gridSize * hexGrid.verticalSpacing + hexGrid.hexHeight / 2;

    STATE.panOffset.x = (rect.width - gridWidth * STATE.zoom) / 2;
    STATE.panOffset.y = (rect.height - gridHeight * STATE.zoom) / 2;

    render();
}

function render() {
    const ctx = elements.ctx;
    const canvas = elements.canvas;
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;

    // Clear canvas
    ctx.fillStyle = CONFIG.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Apply transformations
    ctx.save();
    ctx.translate(STATE.panOffset.x, STATE.panOffset.y);
    ctx.scale(STATE.zoom, STATE.zoom);

    // Draw grid
    for (let col = 0; col < CONFIG.gridSize; col++) {
        for (let row = 0; row < CONFIG.gridSize; row++) {
            const { x, y } = hexGrid.hexToPixel(col, row);
            const key = `${col},${row}`;
            const color = STATE.hexCells.get(key);

            drawHex(ctx, x, y, CONFIG.hexSize, color, CONFIG.showGridLines);
        }
    }

    // Draw hover highlight
    if (STATE.hoveredHex && !STATE.isPanning) {
        const { x, y } = hexGrid.hexToPixel(STATE.hoveredHex.col, STATE.hoveredHex.row);
        drawHexHighlight(ctx, x, y, CONFIG.hexSize);
    }

    ctx.restore();
}

function drawHex(ctx, centerX, centerY, size, fillColor, showOutline) {
    const corners = hexGrid.getHexCorners(centerX, centerY, size);

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }

    if (showOutline) {
        ctx.strokeStyle = CONFIG.gridLineColor;
        ctx.lineWidth = 1 / STATE.zoom;
        ctx.stroke();
    }
}

function drawHexHighlight(ctx, centerX, centerY, size) {
    const corners = hexGrid.getHexCorners(centerX, centerY, size * 0.95);

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    ctx.strokeStyle = STATE.currentColor;
    ctx.lineWidth = 3 / STATE.zoom;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
}

// ============================================================================
// Drawing Tools
// ============================================================================

function getCanvasCoordinates(e) {
    const rect = elements.canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    return { x, y };
}

function drawAtPosition(x, y) {
    const hex = hexGrid.pixelToHex(x, y, CONFIG.hexSize, STATE.panOffset);

    if (hex.col < 0 || hex.col >= CONFIG.gridSize ||
        hex.row < 0 || hex.row >= CONFIG.gridSize) {
        return;
    }

    const key = `${hex.col},${hex.row}`;
    const currentCellColor = STATE.hexCells.get(key);

    switch (STATE.currentTool) {
        case 'draw':
            if (currentCellColor !== STATE.currentColor) {
                STATE.hexCells.set(key, STATE.currentColor);
                audio.playDrawSound();
                createRipple(x, y);
            }
            break;
        case 'erase':
            if (STATE.hexCells.has(key)) {
                STATE.hexCells.delete(key);
                audio.playEraseSound();
            }
            break;
        case 'fill':
            floodFill(hex.col, hex.row, currentCellColor, STATE.currentColor);
            break;
    }

    render();
}

function floodFill(startCol, startRow, targetColor, fillColor) {
    if (targetColor === fillColor) return;

    const visited = new Set();
    const stack = [{ col: startCol, row: startRow }];
    let filled = 0;

    while (stack.length > 0 && filled < 1000) {
        const { col, row } = stack.pop();
        const key = `${col},${row}`;

        if (visited.has(key)) continue;
        visited.add(key);

        const cellColor = STATE.hexCells.get(key);
        if (cellColor !== targetColor) continue;

        if (fillColor) {
            STATE.hexCells.set(key, fillColor);
        } else {
            STATE.hexCells.delete(key);
        }
        filled++;

        const neighbors = hexGrid.getNeighbors(col, row);
        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.col},${neighbor.row}`;
            if (!visited.has(neighborKey)) {
                stack.push(neighbor);
            }
        }
    }

    if (filled > 0) {
        audio.playFillSound();
    }
}

// ============================================================================
// History (Undo/Redo)
// ============================================================================

function saveState() {
    // Remove any future states if we're not at the end
    if (STATE.historyIndex < STATE.history.length - 1) {
        STATE.history = STATE.history.slice(0, STATE.historyIndex + 1);
    }

    // Create snapshot of current state
    const snapshot = new Map(STATE.hexCells);
    STATE.history.push(snapshot);

    // Limit history size
    if (STATE.history.length > CONFIG.maxHistorySteps) {
        STATE.history.shift();
    } else {
        STATE.historyIndex++;
    }

    updateHistoryButtons();
}

function undo() {
    if (STATE.historyIndex > 0) {
        STATE.historyIndex--;
        STATE.hexCells = new Map(STATE.history[STATE.historyIndex]);
        audio.playUndoSound();
        render();
        updateHistoryButtons();
    }
}

function redo() {
    if (STATE.historyIndex < STATE.history.length - 1) {
        STATE.historyIndex++;
        STATE.hexCells = new Map(STATE.history[STATE.historyIndex]);
        audio.playRedoSound();
        render();
        updateHistoryButtons();
    }
}

function updateHistoryButtons() {
    elements.undoBtn.disabled = STATE.historyIndex <= 0;
    elements.redoBtn.disabled = STATE.historyIndex >= STATE.history.length - 1;
}

// ============================================================================
// Zoom & Pan
// ============================================================================

function setZoom(newZoom, centerX, centerY) {
    const oldZoom = STATE.zoom;
    STATE.zoom = Math.max(0.25, Math.min(4, newZoom));

    // Adjust pan to zoom towards center point
    if (centerX !== undefined && centerY !== undefined) {
        const zoomFactor = STATE.zoom / oldZoom;
        STATE.panOffset.x = centerX - (centerX - STATE.panOffset.x) * zoomFactor;
        STATE.panOffset.y = centerY - (centerY - STATE.panOffset.y) * zoomFactor;
    }

    elements.zoomLevel.textContent = Math.round(STATE.zoom * 100) + '%';
    render();
}

function resetView() {
    STATE.zoom = 1;
    resizeCanvas();
    elements.zoomLevel.textContent = '100%';
}

// ============================================================================
// Color Management
// ============================================================================

function setColor(color) {
    STATE.currentColor = color;
    elements.currentColor.style.backgroundColor = color;
    elements.colorPicker.value = color;
    elements.mobileColorPicker.value = color;
    if (elements.mobileColorPreview) {
        elements.mobileColorPreview.style.backgroundColor = color;
    }

    // Update preset selection
    document.querySelectorAll('.preset-color').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === color);
    });

    addRecentColor(color);
}

function addRecentColor(color) {
    // Remove if already exists
    const index = STATE.recentColors.indexOf(color);
    if (index > -1) {
        STATE.recentColors.splice(index, 1);
    }

    // Add to front
    STATE.recentColors.unshift(color);

    // Limit to 8 recent colors
    if (STATE.recentColors.length > 8) {
        STATE.recentColors.pop();
    }

    renderRecentColors();
}

function renderRecentColors() {
    elements.recentColors.innerHTML = '';
    STATE.recentColors.forEach(color => {
        const div = document.createElement('div');
        div.className = 'recent-color';
        div.style.backgroundColor = color;
        div.dataset.color = color;
        div.addEventListener('click', () => {
            setColor(color);
            audio.playClickSound();
        });
        elements.recentColors.appendChild(div);
    });
}

function renderPresetColors() {
    const createColorGrid = (container) => {
        container.innerHTML = '';
        PRESET_COLORS.forEach(color => {
            const div = document.createElement('div');
            div.className = 'preset-color';
            div.style.backgroundColor = color;
            div.dataset.color = color;
            if (color === STATE.currentColor) {
                div.classList.add('selected');
            }
            div.addEventListener('click', () => {
                setColor(color);
                audio.playClickSound();
            });
            container.appendChild(div);
        });
    };

    createColorGrid(elements.presetColors);
    createColorGrid(elements.mobilePresetColors);
}

// ============================================================================
// Visual Effects
// ============================================================================

function createRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'draw-ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.width = '20px';
    ripple.style.height = '20px';
    ripple.style.marginLeft = '-10px';
    ripple.style.marginTop = '-10px';
    ripple.style.backgroundColor = STATE.currentColor;
    elements.canvasContainer.appendChild(ripple);

    setTimeout(() => ripple.remove(), 400);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================================
// File Operations
// ============================================================================

function downloadArt() {
    // Create a new canvas for export
    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');

    // Calculate dimensions
    const padding = 20;
    const gridWidth = CONFIG.gridSize * hexGrid.horizontalSpacing + CONFIG.hexSize;
    const gridHeight = CONFIG.gridSize * hexGrid.verticalSpacing + hexGrid.hexHeight;

    exportCanvas.width = gridWidth + padding * 2;
    exportCanvas.height = gridHeight + padding * 2;

    // Draw background
    exportCtx.fillStyle = CONFIG.backgroundColor;
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw hexes
    exportCtx.translate(padding + CONFIG.hexSize, padding + hexGrid.hexHeight / 2);

    for (let col = 0; col < CONFIG.gridSize; col++) {
        for (let row = 0; row < CONFIG.gridSize; row++) {
            const { x, y } = hexGrid.hexToPixel(col, row);
            const key = `${col},${row}`;
            const color = STATE.hexCells.get(key);

            if (color) {
                const corners = hexGrid.getHexCorners(x, y, CONFIG.hexSize);
                exportCtx.beginPath();
                exportCtx.moveTo(corners[0].x, corners[0].y);
                for (let i = 1; i < 6; i++) {
                    exportCtx.lineTo(corners[i].x, corners[i].y);
                }
                exportCtx.closePath();
                exportCtx.fillStyle = color;
                exportCtx.fill();
            }
        }
    }

    // Download
    const link = document.createElement('a');
    link.download = `hexcraft-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();

    showToast('Art downloaded!', 'success');
    audio.playClickSound();
}

function clearCanvas() {
    if (STATE.hexCells.size === 0) return;

    saveState();
    STATE.hexCells.clear();
    audio.playClearSound();
    render();
    showToast('Canvas cleared', 'info');
}

// ============================================================================
// Settings
// ============================================================================

function openSettings() {
    elements.settingsModal.classList.add('active');
    elements.gridSizeSlider.value = CONFIG.gridSize;
    elements.gridSizeValue.textContent = CONFIG.gridSize;
    elements.hexSizeSlider.value = CONFIG.hexSize;
    elements.hexSizeValue.textContent = CONFIG.hexSize + 'px';
    elements.showGridLines.checked = CONFIG.showGridLines;
    elements.bgColorPicker.value = CONFIG.backgroundColor;
}

function closeSettings() {
    elements.settingsModal.classList.remove('active');
}

function applySettings() {
    CONFIG.gridSize = parseInt(elements.gridSizeSlider.value);
    CONFIG.hexSize = parseInt(elements.hexSizeSlider.value);
    CONFIG.showGridLines = elements.showGridLines.checked;
    CONFIG.backgroundColor = elements.bgColorPicker.value;

    hexGrid.updateDimensions(CONFIG.hexSize);
    resizeCanvas();
    closeSettings();
    showToast('Settings applied', 'success');
}

// ============================================================================
// Touch Gestures
// ============================================================================

let touchStartTime = 0;
let touchStartPosition = null;

function handleTouchStart(e) {
    if (e.touches.length === 2) {
        // Pinch gesture start
        STATE.isPanning = true;
        STATE.pinchDistance = getTouchDistance(e.touches);
        STATE.lastPanPosition = getTouchCenter(e.touches);
    } else if (e.touches.length === 1) {
        touchStartTime = Date.now();
        touchStartPosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        const { x, y } = getCanvasCoordinates(e);
        STATE.isDrawing = true;
        saveState();
        drawAtPosition(x, y);
    }
}

function handleTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 2) {
        // Pinch zoom
        const newDistance = getTouchDistance(e.touches);
        const center = getTouchCenter(e.touches);

        const zoomDelta = newDistance / STATE.pinchDistance;
        setZoom(STATE.zoom * zoomDelta, center.x, center.y);

        // Pan
        const dx = center.x - STATE.lastPanPosition.x;
        const dy = center.y - STATE.lastPanPosition.y;
        STATE.panOffset.x += dx;
        STATE.panOffset.y += dy;

        STATE.pinchDistance = newDistance;
        STATE.lastPanPosition = center;
        render();
    } else if (e.touches.length === 1 && STATE.isDrawing && !STATE.isPanning) {
        const { x, y } = getCanvasCoordinates(e);

        // Check for scroll intent (fast vertical movement)
        if (touchStartPosition) {
            const dy = Math.abs(e.touches[0].clientY - touchStartPosition.y);
            const dx = Math.abs(e.touches[0].clientX - touchStartPosition.x);
            const elapsed = Date.now() - touchStartTime;

            if (elapsed < 200 && dy > 30 && dy > dx * 2) {
                STATE.isDrawing = false;
                STATE.isPanning = true;
                return;
            }
        }

        drawAtPosition(x, y);
        updateHoveredHex(x, y);
    }
}

function handleTouchEnd(e) {
    if (e.touches.length === 0) {
        STATE.isDrawing = false;
        STATE.isPanning = false;
        STATE.hoveredHex = null;
        touchStartPosition = null;
        render();
    } else if (e.touches.length === 1) {
        STATE.isPanning = false;
    }
}

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

// ============================================================================
// Mouse Events
// ============================================================================

function handleMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
        // Middle click or Alt+click for panning
        STATE.isPanning = true;
        STATE.lastPanPosition = { x: e.clientX, y: e.clientY };
        elements.canvas.style.cursor = 'grabbing';
    } else if (e.button === 0) {
        const { x, y } = getCanvasCoordinates(e);
        STATE.isDrawing = true;
        saveState();
        drawAtPosition(x, y);
    }
}

function handleMouseMove(e) {
    const { x, y } = getCanvasCoordinates(e);

    if (STATE.isPanning) {
        const dx = e.clientX - STATE.lastPanPosition.x;
        const dy = e.clientY - STATE.lastPanPosition.y;
        STATE.panOffset.x += dx;
        STATE.panOffset.y += dy;
        STATE.lastPanPosition = { x: e.clientX, y: e.clientY };
        render();
    } else if (STATE.isDrawing) {
        drawAtPosition(x, y);
        updateHoveredHex(x, y);
    } else {
        updateHoveredHex(x, y);
    }
}

function handleMouseUp() {
    STATE.isDrawing = false;
    STATE.isPanning = false;
    elements.canvas.style.cursor = 'crosshair';
}

function handleWheel(e) {
    e.preventDefault();
    const { x, y } = getCanvasCoordinates(e);
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(STATE.zoom * zoomDelta, x, y);
}

function updateHoveredHex(x, y) {
    const hex = hexGrid.pixelToHex(x, y, CONFIG.hexSize, STATE.panOffset);

    if (hex.col >= 0 && hex.col < CONFIG.gridSize &&
        hex.row >= 0 && hex.row < CONFIG.gridSize) {
        STATE.hoveredHex = hex;
    } else {
        STATE.hoveredHex = null;
    }

    render();
}

// ============================================================================
// Tool Selection
// ============================================================================

function selectTool(tool) {
    STATE.currentTool = tool;

    // Update desktop toolbar
    document.querySelectorAll('.toolbar .tool-btn[data-tool]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Update mobile toolbar
    document.querySelectorAll('.mobile-tool[data-tool]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Update mobile menu
    document.querySelectorAll('.mobile-menu-item[data-tool]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Close mobile menu if open
    elements.mobileMenuOverlay.classList.remove('active');

    audio.playClickSound();
}

// ============================================================================
// PWA Installation
// ============================================================================

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show install banner after a delay
    setTimeout(() => {
        if (!localStorage.getItem('installDismissed')) {
            elements.installBanner.classList.add('show');
        }
    }, 5000);
});

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                showToast('Thanks for installing!', 'success');
            }
            deferredPrompt = null;
            elements.installBanner.classList.remove('show');
        });
    }
}

function dismissInstall() {
    elements.installBanner.classList.remove('show');
    localStorage.setItem('installDismissed', 'true');
}

// ============================================================================
// Event Listeners
// ============================================================================

function initEventListeners() {
    // Canvas events
    elements.canvas.addEventListener('mousedown', handleMouseDown);
    elements.canvas.addEventListener('mousemove', handleMouseMove);
    elements.canvas.addEventListener('mouseup', handleMouseUp);
    elements.canvas.addEventListener('mouseleave', () => {
        STATE.hoveredHex = null;
        handleMouseUp();
        render();
    });
    elements.canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Touch events
    elements.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    elements.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    elements.canvas.addEventListener('touchend', handleTouchEnd);
    elements.canvas.addEventListener('touchcancel', handleTouchEnd);

    // Tool selection
    document.querySelectorAll('[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => selectTool(btn.dataset.tool));
    });

    // History buttons
    elements.undoBtn.addEventListener('click', undo);
    elements.redoBtn.addEventListener('click', redo);
    elements.mobileUndo.addEventListener('click', undo);
    elements.mobileRedo.addEventListener('click', redo);

    // Clear and download
    elements.clearBtn.addEventListener('click', clearCanvas);
    elements.downloadBtn.addEventListener('click', downloadArt);
    elements.mobileClear.addEventListener('click', clearCanvas);
    elements.mobileDownload.addEventListener('click', downloadArt);

    // Sound toggle
    const toggleSound = () => {
        const enabled = audio.toggle();
        elements.soundToggle.classList.toggle('muted', !enabled);
        elements.mobileSoundToggle.querySelector('span').textContent = enabled ? 'Sound On' : 'Sound Off';
        audio.playClickSound();
    };
    elements.soundToggle.addEventListener('click', toggleSound);
    elements.mobileSoundToggle.addEventListener('click', toggleSound);

    // Zoom controls
    elements.zoomIn.addEventListener('click', () => setZoom(STATE.zoom * 1.2));
    elements.zoomOut.addEventListener('click', () => setZoom(STATE.zoom * 0.8));
    elements.zoomReset.addEventListener('click', resetView);

    // Color pickers
    elements.colorPicker.addEventListener('input', (e) => setColor(e.target.value));
    elements.mobileColorPicker.addEventListener('input', (e) => setColor(e.target.value));

    // Settings
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.closeSettings.addEventListener('click', closeSettings);
    elements.applySettings.addEventListener('click', applySettings);
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettings();
    });

    // Settings sliders
    elements.gridSizeSlider.addEventListener('input', (e) => {
        elements.gridSizeValue.textContent = e.target.value;
    });
    elements.hexSizeSlider.addEventListener('input', (e) => {
        elements.hexSizeValue.textContent = e.target.value + 'px';
    });

    // Mobile overlays
    elements.mobileColorBtn.addEventListener('click', () => {
        elements.mobileColorOverlay.classList.add('active');
        audio.playClickSound();
    });
    elements.closeMobileColor.addEventListener('click', () => {
        elements.mobileColorOverlay.classList.remove('active');
    });
    elements.mobileColorOverlay.addEventListener('click', (e) => {
        if (e.target === elements.mobileColorOverlay) {
            elements.mobileColorOverlay.classList.remove('active');
        }
    });

    elements.mobileMenu.addEventListener('click', () => {
        elements.mobileMenuOverlay.classList.add('active');
        audio.playClickSound();
    });
    elements.mobileMenuOverlay.addEventListener('click', (e) => {
        if (e.target === elements.mobileMenuOverlay) {
            elements.mobileMenuOverlay.classList.remove('active');
        }
    });

    // Sidebar collapse
    elements.collapseColors.addEventListener('click', () => {
        elements.colorPalette.classList.toggle('collapsed');
    });

    // PWA install
    elements.installBtn.addEventListener('click', installPWA);
    elements.dismissInstall.addEventListener('click', dismissInstall);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;

        switch (e.key.toLowerCase()) {
            case 'd':
                selectTool('draw');
                break;
            case 'f':
                selectTool('fill');
                break;
            case 'e':
                selectTool('erase');
                break;
            case 'z':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                }
                break;
            case 'y':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    redo();
                }
                break;
            case '+':
            case '=':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    setZoom(STATE.zoom * 1.2);
                }
                break;
            case '-':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    setZoom(STATE.zoom * 0.8);
                }
                break;
            case '0':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    resetView();
                }
                break;
        }
    });

    // Window resize
    window.addEventListener('resize', resizeCanvas);

    // Prevent context menu on canvas
    elements.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ============================================================================
// Initialization
// ============================================================================

function init() {
    initElements();
    hexGrid.updateDimensions(CONFIG.hexSize);

    // Set initial color
    setColor(STATE.currentColor);
    renderPresetColors();

    // Initialize canvas
    resizeCanvas();

    // Save initial state
    saveState();

    // Initialize audio on first interaction
    document.addEventListener('click', () => audio.init(), { once: true });
    document.addEventListener('touchstart', () => audio.init(), { once: true });

    initEventListeners();

    console.log('HexCraft initialized!');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
