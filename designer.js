// ==============================================
// Configuration and Utilities
// ==============================================

const CONFIG = {
    // Grid settings
    GRID_SIZE: 20,  // Base grid unit (half-grid)
    FULL_GRID_SIZE: 40,  // Full grid unit
    
    // Canvas dimensions
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 760,
    
    // Visual settings
    GHOST_OPACITY: 0.5,
    BUMP_RADIUS_RATIO: 0.2,
    PREVIEW_BUMP_RATIO: 0.1,
    
    // Colors
    GRID_COLOR_MAIN: '#ddd',
    GRID_COLOR_HALF: '#f0f0f0',
    INVALID_POSITION_COLOR: 'red',
    
    // Box sizes
    AVAILABLE_SIZES: [
        { width: 1, height: 1 }, { width: 1, height: 2 }, { width: 1, height: 3 },
        { width: 2, height: 1 }, { width: 2, height: 2 }, { width: 2, height: 3 },
        { width: 3, height: 1 }, { width: 3, height: 2 }, { width: 3, height: 3 }
    ],
    
    // Storage key
    STORAGE_KEY: 'toniewall_state'
};

const Utils = {
    // Convert size to pixels and grid cells
    toPixels: (size) => ({
        width: (0.5 + size.width * 0.5) * CONFIG.FULL_GRID_SIZE,
        height: (0.5 + size.height * 0.5) * CONFIG.FULL_GRID_SIZE
    }),
    
    // Get box bounds in grid units and check overlap
    getBounds: (box) => {
        const cells = (0.5 + box.width * 0.5) * 2;
        const rows = (0.5 + box.height * 0.5) * 2;
        return { left: box.x, right: box.x + cells, top: box.y, bottom: box.y + rows };
    },
    
    // Get number of connector bumps based on width
    getBumpCount: (width) => width <= 1 ? 2 : (width === 2 ? 3 : 4),
    
    // Check if two rectangles overlap
    doOverlap: (a, b) => !(a.right <= b.left || a.left >= b.right || 
                          a.bottom <= b.top || a.top >= b.bottom)
};

// ==============================================
// Helper Classes
// ==============================================

class ColorManager {
    constructor() {
        this.palettes = {
            custom: ['#ff0066', '#996699', '#99cccc', '#FEFCFF'],
            pastels: ['#FFB6C1', '#B6E3FF', '#B6FFB6', '#FFFFB6'],
            other: ['#FF4444', '#4444FF', '#44FF44']
        };
        this.recentColors = new Set();
        this.selectedColor = this.palettes.custom[0];
        this.onColorChange = null;
    }

    setupColorControls(controlsElement) {
        const colorSection = document.createElement('div');
        colorSection.className = 'color-section';
        
        // Create and add color grid
        const colorGrid = document.createElement('div');
        colorGrid.className = 'palette';
        Object.values(this.palettes).flat().forEach(color => 
            colorGrid.appendChild(this.createColorButton(color)));
        colorGrid.appendChild(this.createCustomColorPicker());
        
        // Create and add recent colors section
        this.recentColorsContainer = document.createElement('div');
        this.recentColorsContainer.className = 'palette';
        const recentSection = document.createElement('div');
        recentSection.className = 'recent-colors';
        recentSection.innerHTML = '<h4>Recent</h4>';
        recentSection.appendChild(this.recentColorsContainer);
        
        colorSection.append(colorGrid, recentSection);
        controlsElement.querySelector('.color-picker').replaceWith(colorSection);
    }

    createColorButton(color) {
        const btn = document.createElement('button');
        btn.className = 'color-option' + (color === this.selectedColor ? ' selected' : '');
        btn.style.backgroundColor = color;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.selectColor(color);
            document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
        return btn;
    }

    createCustomColorPicker() {
        const wrapper = document.createElement('div');
        wrapper.className = 'color-option-wrapper';
        wrapper.style.position = 'relative';
        
        const input = document.createElement('input');
        input.type = 'color';
        input.className = 'color-option custom-color';
        input.onchange = (e) => this.selectColor(e.target.value);
        
        const label = document.createElement('span');
        label.textContent = '+';
        label.className = 'custom-label';
        Object.assign(label.style, { right: '27px', top: '-4px' });
        
        wrapper.append(input, label);
        return wrapper;
    }

    selectColor(color) {
        this.selectedColor = color;
        if (!Object.values(this.palettes).flat().includes(color)) {
            this.recentColors.add(color);
            this.updateRecentColors();
        }
        this.onColorChange?.(color);
    }

    updateRecentColors() {
        if (!this.recentColorsContainer) return;
        this.recentColorsContainer.innerHTML = '';
        [...this.recentColors].slice(-6).forEach(color => 
            this.recentColorsContainer.appendChild(this.createColorButton(color)));
    }

    getSelectedColor() {
        return this.selectedColor;
    }

    updatePreviews() {
        this.previewElements?.forEach((preview, size) => {
            const ctx = preview.getContext('2d');
            ctx.clearRect(0, 0, preview.width, preview.height);
            
            const previewBox = {
                x: 0,
                y: 0,
                width: size.width,
                height: size.height,
                color: this.selectedColor
            };
            
            // Draw the preview box
            const previewSize = 15;
            const scale = previewSize / CONFIG.GRID_SIZE;
            ctx.save();
            ctx.scale(scale, scale);
            
            // Draw box with border
            const { width: pixelWidth, height: pixelHeight } = Utils.toPixels(previewBox);
            ctx.fillStyle = previewBox.color;
            ctx.fillRect(0, 0, pixelWidth, pixelHeight);
            ctx.strokeStyle = '#000';
            ctx.strokeRect(0, 0, pixelWidth, pixelHeight);
            
            ctx.restore();
        });
    }
}

class SummaryManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.table = document.createElement('table');
        Object.assign(this.table.style, { width: '100%', borderCollapse: 'collapse' });
        this.container.appendChild(this.table);
    }

    update(boxes) {
        const summary = boxes.reduce((acc, box) => {
            const key = `${box.width}x${box.height}`;
            if (!acc[key]) acc[key] = {};
            if (!acc[key][box.color]) acc[key][box.color] = 0;
            acc[key][box.color]++;
            return acc;
        }, {});

        const sortedSizes = Object.keys(summary).sort((a, b) => {
            const [aW, aH] = a.split('x').map(Number);
            const [bW, bH] = b.split('x').map(Number);
            return (aW * aH) - (bW * bH);
        });

        this.table.innerHTML = '';
        sortedSizes.forEach(size => this.addSizeRow(size, summary[size]));
        this.addTotalRow(summary);
    }

    addSizeRow(size, colorCounts) {
        const row = document.createElement('tr');
        const sizeCell = this.createCell(size, { width: '60px', borderBottom: '1px solid #eee' });
        const colorsCell = this.createCell('', { borderBottom: '1px solid #eee' });
        
        Object.entries(colorCounts).forEach(([color, count]) => {
            const container = document.createElement('span');
            container.style.cssText = 'display: inline-block; margin-right: 8px;';
            
            const colorBox = document.createElement('span');
            colorBox.style.cssText = `display: inline-block; width: 15px; height: 15px; 
                                    background-color: ${color}; border: 1px solid #ccc; 
                                    position: relative; top: 3px; margin-right: 4px;`;
            
            container.append(colorBox, document.createTextNode(` x${count}`));
            colorsCell.appendChild(container);
        });
        
        row.append(sizeCell, colorsCell);
        this.table.appendChild(row);
    }

    addTotalRow(summary) {
        const total = Object.values(summary).reduce((sum, colors) => 
            sum + Object.values(colors).reduce((a, b) => a + b, 0), 0);
        
        const row = document.createElement('tr');
        Object.assign(row.style, { borderTop: '2px solid #ccc', fontWeight: 'bold' });
        row.append(this.createCell('Total'), this.createCell(total.toString()));
        this.table.appendChild(row);
    }

    createCell(content, styles = {}) {
        const cell = document.createElement('td');
        cell.textContent = content;
        Object.assign(cell.style, { padding: '4px', ...styles });
        return cell;
    }
}

class TrashZone {
    constructor(designer) {
        this.designer = designer;
        this.width = CONFIG.FULL_GRID_SIZE * 2;
        this.height = CONFIG.FULL_GRID_SIZE * 2;
        this.isHovered = false;
        this.justFinishedDrag = false;
    }

    draw(ctx) {
        const x = this.designer.canvas.width - this.width;
        const y = this.designer.canvas.height - this.height;
        
        ctx.save();
        ctx.strokeStyle = ctx.fillStyle = '#ff4444';
        ctx.lineWidth = 2;
        
        // Draw background
        ctx.fillStyle = this.isHovered ? '#ffeeee' : 'white';
        ctx.beginPath();
        ctx.rect(x, y, this.width, this.height);
        ctx.fill();
        ctx.stroke();
        
        // Draw trash can icon
        const p = CONFIG.GRID_SIZE * 0.3;
        const ix = x + p, iy = y + p;
        const iw = this.width - 2*p, ih = this.height - 2*p;
        
        // Main can shape
        ctx.beginPath();
        ctx.moveTo(ix + iw*0.1, iy + ih*0.2);
        ctx.lineTo(ix + iw*0.9, iy + ih*0.2);
        ctx.lineTo(ix + iw*0.8, iy + ih);
        ctx.lineTo(ix + iw*0.2, iy + ih);
        ctx.closePath();
        ctx.stroke();
        
        // Lid and handle
        ctx.beginPath();
        ctx.moveTo(ix, iy + ih*0.15);
        ctx.lineTo(ix + iw, iy + ih*0.15);
        ctx.moveTo(ix + iw*0.35, iy + ih*0.15);
        ctx.lineTo(ix + iw*0.35, iy);
        ctx.lineTo(ix + iw*0.65, iy);
        ctx.lineTo(ix + iw*0.65, iy + ih*0.15);
        ctx.stroke();
        
        // Stripes
        for (let i = 0; i <= 3; i++) {
            const sy = iy + ih*0.3 + (ih*0.6*i/3);
            const offset = (i/3) * 0.1;
            ctx.beginPath();
            ctx.moveTo(ix + iw*0.2 + iw*0.6*offset, sy);
            ctx.lineTo(ix + iw*0.8 - iw*0.6*offset, sy);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    isInZone(pos) {
        const x = pos.x * CONFIG.GRID_SIZE;
        const y = pos.y * CONFIG.GRID_SIZE;
        const zoneX = this.designer.canvas.width - this.width;
        const zoneY = this.designer.canvas.height - this.height;
        return x >= zoneX && x <= zoneX + this.width && 
               y >= zoneY && y <= zoneY + this.height;
    }

    handleClick() {
        if (!this.designer.selectedBox && !this.designer.draggedSize && !this.justFinishedDrag &&
            confirm('Are you sure you want to remove all boxes?')) {
            this.designer.boxes = [];
            this.designer.draw();
            this.designer.updateSummary();
        }
    }

    setDragComplete() {
        this.justFinishedDrag = true;
        setTimeout(() => this.justFinishedDrag = false, 100);
    }

    updateHoverState(pos) {
        const wasHovered = this.isHovered;
        this.isHovered = this.isInZone(pos);
        return wasHovered !== this.isHovered;
    }
}

// ==============================================
// Main Designer Class
// ==============================================

class TonieWallDesigner {
    // ----------------
    // Initialization
    // ----------------
    constructor() {
        this.initializeCanvas();
        this.initializeState();
        this.initializeDragAndDrop();
        this.initializeManagers();
        this.setupEventListeners();
        
        // Load saved state or start fresh
        this.loadState();
        this.draw();
        this.updateSummary();
        
        // Save state when leaving page
        window.addEventListener('beforeunload', () => this.saveState());
    }

    initializeCanvas() {
        this.canvas = document.getElementById('designCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;
        this.gridSize = CONFIG.GRID_SIZE;
        this.fullGridSize = CONFIG.FULL_GRID_SIZE;
    }

    initializeState() {
        this.boxes = [];
        this.selectedSize = { width: 1, height: 1 };
        this.draggedSize = null;
        this.selectedBox = null;
        this.dragOffset = null;
        this.mousePos = { x: 0, y: 0 };
        this.justFinishedDrag = false;
        this.previewElements = new Map();
    }

    initializeDragAndDrop() {
        // Create optimized drag preview element
        this.dragPreview = document.createElement('div');
        this.dragPreview.style.position = 'fixed';
        this.dragPreview.style.pointerEvents = 'none';
        this.dragPreview.style.zIndex = '1000';
        this.dragPreview.style.opacity = '0.8';
        this.dragPreview.style.border = '1px solid black';
        this.dragPreview.style.display = 'none';
        document.body.appendChild(this.dragPreview);
    }

    initializeManagers() {
        this.colorManager = new ColorManager();
        this.colorManager.onColorChange = (color) => {
            this.selectedColor = color;
            CONFIG.AVAILABLE_SIZES.forEach(size => {
                this.updatePreview(this.previewElements.get(size), size);
            });
        };
        this.selectedColor = this.colorManager.getSelectedColor();
        
        this.trashZone = new TrashZone(this);
        this.summaryManager = new SummaryManager('boxCount');
        
        this.setupControls();
    }

    // ----------------
    // UI Setup
    // ----------------
    setupControls() {
        const controls = document.getElementById('controls');
        this.setupBoxOptions(controls);
        this.colorManager.setupColorControls(controls);
    }

    setupBoxOptions(controls) {
        const boxOptions = document.getElementById('boxOptions');
        CONFIG.AVAILABLE_SIZES.forEach(size => {
            const option = document.createElement('div');
            option.className = 'box-option';
            
            // Create a mini canvas for the shape preview
            const preview = document.createElement('canvas');
            const previewSize = 15;
            const actualWidth = 0.5 + (size.width * 0.5);
            const actualHeight = 0.5 + (size.height * 0.5);
            preview.width = previewSize * actualWidth * 2;
            preview.height = previewSize * actualHeight * 2;
            
            this.previewElements.set(size, preview);
            this.updatePreview(preview, size);
            
            const label = document.createElement('span');
            label.textContent = `${size.width}x${size.height}`;
            label.style.marginLeft = '10px';
            
            option.appendChild(preview);
            option.appendChild(label);

            this.setupDragAndDrop(option, size);
            boxOptions.appendChild(option);
        });
    }

    setupDragAndDrop(option, size) {
        option.draggable = true;
        
        option.addEventListener('dragstart', (e) => {
            this.draggedSize = size;
            this.selectedSize = size;
            
            // Set up drag preview with correct dimensions
            const { width: pixelWidth, height: pixelHeight } = Utils.toPixels(size);
            this.dragPreview.style.width = `${pixelWidth}px`;
            this.dragPreview.style.height = `${pixelHeight}px`;
            this.dragPreview.style.backgroundColor = this.selectedColor;
            this.dragPreview.style.display = 'block';
            this.dragPreview.style.left = `${e.clientX - (pixelWidth / 2)}px`;
            this.dragPreview.style.top = `${e.clientY - (pixelHeight / 2)}px`;

            // Create a 1x1 transparent image for the drag ghost
            const img = new Image();
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            e.dataTransfer.setDragImage(img, 0, 0);

            document.querySelectorAll('.box-option').forEach(opt => 
                opt.classList.remove('selected'));
            option.classList.add('selected');
        });

        option.addEventListener('drag', (e) => {
            if (!e.clientX && !e.clientY) return; // Ignore invalid positions
            
            const { width: pixelWidth, height: pixelHeight } = Utils.toPixels(this.draggedSize);
            this.dragPreview.style.left = `${e.clientX - (pixelWidth / 2)}px`;
            this.dragPreview.style.top = `${e.clientY - (pixelHeight / 2)}px`;
        });

        option.addEventListener('dragend', () => {
            this.dragPreview.style.display = 'none';
        });
    }

    setupEventListeners() {
        // Mouse events for box manipulation
        this.canvas.addEventListener('mousedown', this.handleBoxDragStart.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleBoxDragEnd.bind(this));
        
        // Box placement events
        this.canvas.addEventListener('dragover', this.handleBoxPlacementPreview.bind(this));
        this.canvas.addEventListener('dragleave', () => this.draw());
        this.canvas.addEventListener('drop', this.handleBoxPlacement.bind(this));
        
        // Other interactions
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        
        // Track mouse position
        window.addEventListener('mousemove', (e) => {
            this.mousePos = { x: e.clientX, y: e.clientY };
        });
    }

    // ----------------
    // Event Handlers
    // ----------------
    handleBoxDragStart(e) {
        if (e.button !== 0) return; // Left click only
        
        const pos = this.getGridPosition(e);
        const clickedBox = this.findBoxAt(pos);
        
        if (clickedBox) {
            this.selectedBox = clickedBox;
            this.dragOffset = {
                x: pos.x - clickedBox.x,
                y: pos.y - clickedBox.y
            };
            this.canvas.style.cursor = 'grabbing';
        }
    }

    handleMouseMove(e) {
        const pos = this.getGridPosition(e);
        
        // Update trash zone hover state
        if (this.trashZone.updateHoverState(pos)) {
            this.draw();
        }

        // Handle box movement or hover effects
        if (this.selectedBox) {
            this.previewBoxMove(pos);
        } else {
            this.canvas.style.cursor = this.findBoxAt(pos) ? 'grab' : 'default';
        }
    }

    handleBoxDragEnd(e) {
        if (!this.selectedBox) return;

        const pos = this.getGridPosition(e);
        if (this.trashZone.isInZone(pos)) {
            this.deleteBox(this.selectedBox);
            this.trashZone.setDragComplete();
        } else {
            const newPos = {
                x: pos.x - this.dragOffset.x,
                y: pos.y - this.dragOffset.y
            };
            this.tryMoveBox(this.selectedBox, newPos);
        }

        this.selectedBox = null;
        this.dragOffset = null;
        this.canvas.style.cursor = 'default';
        this.draw();
        this.updateSummary();
    }

    handleBoxPlacementPreview(e) {
        e.preventDefault();
        if (!this.draggedSize) return;
        
        const pos = this.getGridPosition(e);
        this.previewBoxPlacement(pos);
    }

    handleBoxPlacement(e) {
        e.preventDefault();
        if (!this.draggedSize) return;
        
        const pos = this.getGridPosition(e);
        this.tryPlaceBox(pos);
        this.draggedSize = null;
        this.draw();
    }

    handleClick(e) {
        const pos = this.getGridPosition(e);
        if (this.trashZone.isInZone(pos)) {
            this.trashZone.handleClick();
        }
    }

    handleContextMenu(e) {
        e.preventDefault();
        const pos = this.getGridPosition(e);
        const clickedBox = this.findBoxAt(pos);
        
        if (clickedBox) {
            this.deleteBox(clickedBox);
            this.draw();
            this.updateSummary();
        }
    }

    // ----------------
    // Drawing Methods
    // ----------------
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
        this.boxes.forEach(box => this.drawBox(box));
        this.trashZone.draw(this.ctx);
    }

    drawGrid() {
        const drawLines = (spacing, color) => {
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1;

            for (let x = 0; x <= this.canvas.width; x += spacing) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.canvas.height);
                this.ctx.stroke();
            }

            for (let y = 0; y <= this.canvas.height; y += spacing) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();
            }
        };

        drawLines(CONFIG.FULL_GRID_SIZE, CONFIG.GRID_COLOR_MAIN);
        drawLines(CONFIG.GRID_SIZE, CONFIG.GRID_COLOR_HALF);
    }

    drawBox(box, options = {}) {
        const pixelX = box.x * CONFIG.GRID_SIZE;
        const pixelY = box.y * CONFIG.GRID_SIZE;
        const { width, height } = Utils.toPixels(box);
        
        this.ctx.save();
        
        // Set ghost transparency if needed
        if (options.isGhost) {
            this.ctx.globalAlpha = CONFIG.GHOST_OPACITY;
        }
        
        // Draw box body
        this.ctx.fillStyle = box.color;
        this.ctx.fillRect(pixelX, pixelY, width, height);
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeRect(pixelX, pixelY, width, height);
        
        // Draw connector bumps
        const bumpRadius = CONFIG.GRID_SIZE * (options.isGhost ? CONFIG.PREVIEW_BUMP_RATIO : CONFIG.BUMP_RADIUS_RATIO);
        const spacing = width / (Utils.getBumpCount(box.width) + 1);
        
        this.ctx.beginPath();
        for (let i = 1; i <= Utils.getBumpCount(box.width); i++) {
            this.ctx.arc(pixelX + spacing * i, pixelY + height, bumpRadius, 0, Math.PI, true);
        }
        this.ctx.fillStyle = '#000';
        this.ctx.fill();
        
        this.ctx.restore();
    }

    updatePreview(canvas, size) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const previewBox = {
            x: 0,
            y: 0,
            width: size.width,
            height: size.height,
            color: this.selectedColor
        };
        
        // Use same drawing logic with scaled context
        const originalCtx = this.ctx;
        this.ctx = ctx;
        
        const scale = 15 / CONFIG.GRID_SIZE; // 15 pixels per grid unit for preview
        ctx.save();
        ctx.scale(scale, scale);
        
        this.drawBox(previewBox);
        
        ctx.restore();
        this.ctx = originalCtx;
    }

    // ----------------
    // Box Management
    // ----------------
    tryMoveBox(box, newPos) {
        const boxIndex = this.boxes.indexOf(box);
        this.boxes.splice(boxIndex, 1);

        const isValid = this.isValidPosition({
            x: newPos.x,
            y: newPos.y,
            width: box.width,
            height: box.height
        });

        if (isValid) {
            box.x = newPos.x;
            box.y = newPos.y;
        }

        this.boxes.splice(boxIndex, 0, box);
        this.saveState(); // Save after moving a box
    }

    tryPlaceBox(pos) {
        // Use the unified isValidPosition method
        const isValid = this.isValidPosition({
            x: pos.x,
            y: pos.y,
            width: this.selectedSize.width,
            height: this.selectedSize.height
        });

        if (!isValid) return;

        // Add the new box
        this.boxes.push({
            x: pos.x,
            y: pos.y,
            width: this.selectedSize.width,
            height: this.selectedSize.height,
            color: this.selectedColor
        });

        this.draw();
        this.updateSummary();
        this.saveState(); // Save after adding a box
    }

    deleteBox(box) {
        const index = this.boxes.indexOf(box);
        if (index > -1) {
            this.boxes.splice(index, 1);
            this.saveState(); // Save after deleting a box
        }
    }

    // ----------------
    // Box Validation
    // ----------------
    isValidPosition(box) {
        const bounds = Utils.getBounds(box);
        const maxX = this.canvas.width / CONFIG.GRID_SIZE;
        const maxY = this.canvas.height / CONFIG.GRID_SIZE;
        
        // Check canvas bounds
        if (bounds.left < 0 || bounds.top < 0 || bounds.right > maxX || bounds.bottom > maxY) {
            return false;
        }

        // Check overlap with other boxes
        return !this.boxes.some(other => 
            other !== this.selectedBox && this.doOverlap(bounds, Utils.getBounds(other))
        );
    }

    doOverlap(a, b) {
        return !(a.right <= b.left || a.left >= b.right || 
                a.bottom <= b.top || a.top >= b.bottom);
    }

    findBoxAt(pos) {
        return this.boxes.find(box => {
            const bounds = Utils.getBounds(box);
            return pos.x >= bounds.left && pos.x < bounds.right && 
                   pos.y >= bounds.top && pos.y < bounds.bottom;
        });
    }

    // ----------------
    // Utility Methods
    // ----------------
    getGridPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / CONFIG.GRID_SIZE);
        const y = Math.floor((event.clientY - rect.top) / CONFIG.GRID_SIZE);
        return { x, y };
    }

    updateSummary() {
        this.summaryManager.update(this.boxes);
    }

    // ----------------
    // Preview Methods
    // ----------------
    previewBoxMove(pos) {
        const newPos = {
            x: pos.x - this.dragOffset.x,
            y: pos.y - this.dragOffset.y
        };

        // Temporarily remove the selected box for collision checking
        const boxIndex = this.boxes.indexOf(this.selectedBox);
        this.boxes.splice(boxIndex, 1);

        // Check position validity and draw preview
        const isValid = this.isValidPosition({
            x: newPos.x,
            y: newPos.y,
            width: this.selectedBox.width,
            height: this.selectedBox.height
        });

        // Restore the box
        this.boxes.splice(boxIndex, 0, this.selectedBox);

        // Draw preview
        this.draw();
        this.drawBox({
            ...this.selectedBox,
            x: newPos.x,
            y: newPos.y,
            color: isValid ? this.selectedBox.color : CONFIG.INVALID_POSITION_COLOR
        }, { isGhost: true });
    }

    previewBoxPlacement(pos) {
        const isValid = this.isValidPosition({
            x: pos.x,
            y: pos.y,
            width: this.draggedSize.width,
            height: this.draggedSize.height
        });

        this.draw();
        this.drawBox({
            x: pos.x,
            y: pos.y,
            width: this.draggedSize.width,
            height: this.draggedSize.height,
            color: isValid ? this.selectedColor : CONFIG.INVALID_POSITION_COLOR
        }, { isGhost: true });
    }

    // ----------------
    // State Management
    // ----------------
    saveState() {
        const state = {
            boxes: this.boxes,
            recentColors: [...this.colorManager.recentColors]
        };
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state));
    }

    loadState() {
        try {
            const savedState = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (savedState) {
                const state = JSON.parse(savedState);
                this.boxes = state.boxes;
                state.recentColors.forEach(color => {
                    this.colorManager.recentColors.add(color);
                    this.colorManager.updateRecentColors();
                });
            }
        } catch (error) {
            console.warn('Failed to load saved state:', error);
        }
    }
}

// ==============================================
// Initialization
// ==============================================

window.addEventListener('load', () => {
    new TonieWallDesigner();
}); 