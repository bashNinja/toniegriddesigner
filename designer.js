class TonieWallDesigner {
    constructor() {
        this.canvas = document.getElementById('designCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 20; // pixels per half grid unit (40px total for a full unit)
        this.fullGridSize = this.gridSize * 2; // Full grid unit size
        
        // Set canvas size
        this.canvas.width = 1200;
        this.canvas.height = 760;
        
        this.boxes = []; // Placed boxes
        this.selectedSize = { width: 1, height: 1 };
        this.selectedColor = '#000000';
        this.isDragging = false;
        this.currentPosition = null;
        this.draggedSize = null;
        this.dragStartPos = null;
        this.ghostElement = null;
        this.selectedBox = null;  // Track which box is being moved
        this.dragOffset = null;   // Track where in the box we clicked

        // Available box sizes (width x height)
        this.availableSizes = [
            { width: 1, height: 1 },
            { width: 1, height: 2 },
            { width: 1, height: 3 },
            { width: 2, height: 1 },
            { width: 2, height: 2 },
            { width: 2, height: 3 },
            { width: 3, height: 1 },
            { width: 3, height: 2 },
            { width: 3, height: 3 }
        ];

        // Predefined color palettes
        this.colorPalettes = {
            custom: [
                '#ff0066', // bright pink
                '#996699', // muted purple
                '#99cccc', // light blue-gray
                '#FEFCFF'  // milk white
            ],
            pastels: [
                '#FFB6C1', // light pink
                '#B6E3FF', // light blue
                '#B6FFB6', // light green
                '#FFFFB6'  // light yellow
            ],
            other: [
                '#FF4444', // red
                '#4444FF', // blue
                '#44FF44'  // green
            ]
        };
        
        this.recentColors = new Set(); // Keep track of recently used colors
        this.selectedColor = this.colorPalettes.custom[0];

        this.previewElements = new Map(); // Store references to preview canvases
        this.dragImages = new Map(); // Store pre-created drag images

        // Create optimized drag preview element
        this.dragPreview = document.createElement('div');
        this.dragPreview.style.position = 'fixed';
        this.dragPreview.style.pointerEvents = 'none';
        this.dragPreview.style.zIndex = '1000';
        this.dragPreview.style.opacity = '0.8';
        this.dragPreview.style.border = '1px solid black';
        this.dragPreview.style.display = 'none';
        document.body.appendChild(this.dragPreview);

        // Track mouse position for custom drag preview
        this.mousePos = { x: 0, y: 0 };
        window.addEventListener('mousemove', (e) => {
            this.mousePos = { x: e.clientX, y: e.clientY };
        });

        // Track if we just finished a drag operation
        this.justFinishedDrag = false;

        // Define trash zone area
        this.trashZone = {
            width: this.fullGridSize * 2,  // 2 grid squares wide
            height: this.fullGridSize * 2, // 2 grid squares tall
            padding: 0  // No padding since we're using grid squares
        };
        this.isTrashHovered = false;

        this.setupControls();
        this.setupEventListeners();
        this.setupContextMenu();
        this.draw();
        this.updateSummary();
    }

    setupControls() {
        const boxOptions = document.getElementById('boxOptions');
        this.availableSizes.forEach(size => {
            const option = document.createElement('div');
            option.className = 'box-option';
            
            // Create a mini canvas for the shape preview
            const preview = document.createElement('canvas');
            const previewSize = 15; // Reduced from 20
            const actualWidth = 0.5 + (size.width * 0.5);  // Exact formula
            const actualHeight = 0.5 + (size.height * 0.5); // Exact formula
            preview.width = previewSize * actualWidth * 2;  // Double size for full grid units
            preview.height = previewSize * actualHeight * 2;
            
            this.previewElements.set(size, preview);
            this.updatePreview(preview, size);
            
            const label = document.createElement('span');
            label.textContent = `${size.width}x${size.height}`;
            label.style.marginLeft = '10px';
            
            option.appendChild(preview);
            option.appendChild(label);

            // Custom drag handling
            option.draggable = true;
            option.addEventListener('dragstart', (e) => {
                this.draggedSize = size;
                this.selectedSize = size;
                
                // Set up drag preview with correct dimensions
                const actualWidth = 0.5 + (size.width * 0.5);  // Exact formula
                const actualHeight = 0.5 + (size.height * 0.5); // Exact formula
                this.dragPreview.style.width = `${actualWidth * this.fullGridSize}px`;
                this.dragPreview.style.height = `${actualHeight * this.fullGridSize}px`;
                this.dragPreview.style.backgroundColor = this.selectedColor;
                this.dragPreview.style.display = 'block';
                this.dragPreview.style.left = `${e.clientX - (actualWidth * this.fullGridSize / 2)}px`;
                this.dragPreview.style.top = `${e.clientY - (actualHeight * this.fullGridSize / 2)}px`;

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
                
                const actualWidth = 0.5 + (this.draggedSize.width * 0.5);  // Exact formula
                const actualHeight = 0.5 + (this.draggedSize.height * 0.5); // Exact formula
                this.dragPreview.style.left = `${e.clientX - (actualWidth * this.fullGridSize / 2)}px`;
                this.dragPreview.style.top = `${e.clientY - (actualHeight * this.fullGridSize / 2)}px`;
            });

            option.addEventListener('dragend', () => {
                this.dragPreview.style.display = 'none';
            });

            boxOptions.appendChild(option);
        });

        this.setupColorControls();
    }

    updatePreview(canvas, size) {
        const ctx = canvas.getContext('2d');
        const previewSize = 20; // pixels per unit in preview

        // Clear and draw main box
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = this.selectedColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        // Draw bumps in preview
        const bumpRadius = previewSize * 0.1;
        const bottomY = canvas.height;
        const numBumps = size.width <= 1 ? 2 : (size.width === 2 ? 3 : 4);
        const spacing = canvas.width / (numBumps + 1);

        ctx.beginPath();
        for (let i = 1; i <= numBumps; i++) {
            const bumpX = spacing * i;
            ctx.arc(
                bumpX,
                bottomY,
                bumpRadius,
                0,
                Math.PI,
                true
            );
        }
        ctx.fillStyle = '#000';
        ctx.fill();
    }

    setupColorControls() {
        const controls = document.getElementById('controls');
        const colorSection = document.createElement('div');
        colorSection.className = 'color-section';
        
        // Create color grid for preset colors
        const colorGrid = document.createElement('div');
        colorGrid.className = 'palette';
        
        // Add all palette colors first
        Object.values(this.colorPalettes).flat().forEach(color => {
            const colorButton = document.createElement('button');
            colorButton.className = 'color-option';
            colorButton.style.backgroundColor = color;
            colorButton.onclick = () => this.selectColor(color);
            colorGrid.appendChild(colorButton);
        });
        
        // Add custom color picker with wrapper for label at the end
        const customWrapper = document.createElement('div');
        customWrapper.className = 'color-option-wrapper';
        customWrapper.style.position = 'relative';
        
        const customColor = document.createElement('input');
        customColor.type = 'color';
        customColor.value = '#000000';
        customColor.className = 'color-option custom-color';
        customColor.onchange = (e) => this.selectColor(e.target.value);
        
        // Add custom label
        const customLabel = document.createElement('span');
        customLabel.textContent = '+';
        customLabel.className = 'custom-label';
        customLabel.style.right = '27px';
        customLabel.style.top = '-4px';
        
        customWrapper.appendChild(customColor);
        customWrapper.appendChild(customLabel);
        colorGrid.appendChild(customWrapper);
        
        // Add recent colors section
        const recentSection = document.createElement('div');
        recentSection.className = 'recent-colors';
        recentSection.innerHTML = '<h4>Recent</h4>';
        this.recentColorsContainer = document.createElement('div');
        this.recentColorsContainer.className = 'palette';
        recentSection.appendChild(this.recentColorsContainer);
        
        colorSection.appendChild(colorGrid);
        colorSection.appendChild(recentSection);
        
        // Replace old color picker
        const oldColorPicker = controls.querySelector('.color-picker');
        oldColorPicker.parentElement.replaceChild(colorSection, oldColorPicker);
    }

    selectColor(color) {
        this.selectedColor = color;
        
        // Update all preview boxes with new color
        this.previewElements.forEach((canvas, size) => {
            this.updatePreview(canvas, size);
        });
        
        // Only add to recent colors if it's not in our predefined palettes
        const allPaletteColors = Object.values(this.colorPalettes).flat();
        if (!allPaletteColors.includes(color)) {
            this.recentColors.add(color);
            this.updateRecentColors();
        }
    }

    updateRecentColors() {
        this.recentColorsContainer.innerHTML = '';
        [...this.recentColors].slice(-6).forEach(color => {
            const colorButton = document.createElement('button');
            colorButton.className = 'color-option';
            colorButton.style.backgroundColor = color;
            colorButton.onclick = () => this.selectColor(color);
            this.recentColorsContainer.appendChild(colorButton);
        });
    }

    setupEventListeners() {
        // Remove old mouse event listeners
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);

        // Add drag and drop event listeners for new boxes
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.draggedSize) {
                const pos = this.getGridPosition(e);
                this.showGhostBox(pos);
            }
        });

        this.canvas.addEventListener('dragleave', () => {
            this.removeGhostBox();
        });

        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.draggedSize) {
                const pos = this.getGridPosition(e);
                this.tryPlaceBox(pos);
                this.draggedSize = null;
                this.removeGhostBox();
            }
        });

        // Add mouse events for moving existing boxes
        this.canvas.addEventListener('mousedown', (e) => {
            // Only handle left clicks for dragging
            if (e.button !== 0) return;
            
            const pos = this.getGridPosition(e);
            const clickedBox = this.findBoxAt(pos);
            
            if (clickedBox) {
                this.selectedBox = clickedBox;
                // Make the box draggable
                clickedBox.draggable = true;
                
                // Calculate offset within the box
                this.dragOffset = {
                    x: pos.x - clickedBox.x,
                    y: pos.y - clickedBox.y
                };
                this.canvas.style.cursor = 'grabbing';
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const pos = this.getGridPosition(e);
            
            // Update trash hover state
            const wasHovered = this.isTrashHovered;
            this.isTrashHovered = this.isInTrashZone(pos);
            if (wasHovered !== this.isTrashHovered) {
                this.draw(); // Redraw if hover state changed
            }

            if (this.selectedBox) {
                const newPos = {
                    x: pos.x - this.dragOffset.x,
                    y: pos.y - this.dragOffset.y
                };

                // Temporarily remove the selected box from the array
                const boxIndex = this.boxes.indexOf(this.selectedBox);
                this.boxes.splice(boxIndex, 1);

                // Check if new position is valid
                const isValid = this.isValidPosition({
                    x: newPos.x,
                    y: newPos.y,
                    width: this.selectedBox.width,
                    height: this.selectedBox.height
                });

                // Put the box back in the array
                this.boxes.splice(boxIndex, 0, this.selectedBox);

                // Draw ghost preview
                this.draw();
                this.ctx.globalAlpha = 0.5;
                this.ctx.fillStyle = isValid ? this.selectedBox.color : 'red';
                this.ctx.strokeStyle = '#000';
                
                // Use the exact formula for width and height
                const actualWidth = 0.5 + (this.selectedBox.width * 0.5);
                const actualHeight = 0.5 + (this.selectedBox.height * 0.5);
                const pixelWidth = actualWidth * this.fullGridSize;
                const pixelHeight = actualHeight * this.fullGridSize;
                
                this.ctx.fillRect(
                    newPos.x * this.gridSize,
                    newPos.y * this.gridSize,
                    pixelWidth,
                    pixelHeight
                );
                this.ctx.strokeRect(
                    newPos.x * this.gridSize,
                    newPos.y * this.gridSize,
                    pixelWidth,
                    pixelHeight
                );
                this.ctx.globalAlpha = 1.0;
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (this.selectedBox) {
                const pos = this.getGridPosition(e);
                if (this.isInTrashZone(pos)) {
                    this.deleteBox(this.selectedBox);
                    this.selectedBox = null;
                    this.draw();
                    this.updateSummary();
                    this.justFinishedDrag = true;
                    // Reset the flag after a short delay
                    setTimeout(() => {
                        this.justFinishedDrag = false;
                    }, 100);
                } else {
                    const newPos = {
                        x: pos.x - this.dragOffset.x,
                        y: pos.y - this.dragOffset.y
                    };

                    // Temporarily remove the selected box
                    const boxIndex = this.boxes.indexOf(this.selectedBox);
                    this.boxes.splice(boxIndex, 1);

                    // Check if new position is valid
                    const isValid = this.isValidPosition({
                        x: newPos.x,
                        y: newPos.y,
                        width: this.selectedBox.width,
                        height: this.selectedBox.height
                    });

                    if (isValid) {
                        // Update position
                        this.selectedBox.x = newPos.x;
                        this.selectedBox.y = newPos.y;
                    }

                    // Put the box back
                    this.boxes.splice(boxIndex, 0, this.selectedBox);
                    
                    this.selectedBox = null;
                    this.dragOffset = null;
                    this.canvas.style.cursor = 'default';
                    this.draw();
                }
            }
        });

        // Add hover effect
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.selectedBox) {
                const pos = this.getGridPosition(e);
                if (this.findBoxAt(pos)) {
                    this.canvas.style.cursor = 'grab';
                } else {
                    this.canvas.style.cursor = 'default';
                }
            }
        });

        // Add click handler for trash zone to clear all
        this.canvas.addEventListener('click', (e) => {
            const pos = this.getGridPosition(e);
            if (this.isInTrashZone(pos) && !this.selectedBox && !this.draggedSize && !this.justFinishedDrag) {
                if (confirm('Are you sure you want to remove all boxes?')) {
                    this.boxes = [];
                    this.draw();
                    this.updateSummary();
                }
            }
        });
    }

    getGridPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / this.gridSize);
        const y = Math.floor((event.clientY - rect.top) / this.gridSize);
        return { x, y };
    }

    handleMouseDown(event) {
        this.isDragging = true;
        const pos = this.getGridPosition(event);
        this.currentPosition = pos;
        this.tryPlaceBox(pos);
    }

    handleMouseMove(event) {
        if (!this.isDragging) return;
        const pos = this.getGridPosition(event);
        if (pos.x !== this.currentPosition.x || pos.y !== this.currentPosition.y) {
            this.currentPosition = pos;
            this.tryPlaceBox(pos);
        }
    }

    handleMouseUp() {
        this.isDragging = false;
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
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.ctx.lineWidth = 1;
        
        // Draw main grid lines
        this.ctx.strokeStyle = '#ddd';
        for (let x = 0; x <= this.canvas.width; x += this.fullGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += this.fullGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Draw half-grid lines (lighter)
        this.ctx.strokeStyle = '#f0f0f0';
        for (let x = this.gridSize; x < this.canvas.width; x += this.fullGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = this.gridSize; y < this.canvas.height; y += this.fullGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Draw boxes with bumps
        this.boxes.forEach(box => {
            this.drawBoxWithBumps(box);
        });

        // Draw trash icon at the end
        this.drawTrashIcon();
    }

    updateSummary() {
        const summary = {};
        this.boxes.forEach(box => {
            const key = `${box.width}x${box.height}`;
            const colorKey = box.color;
            if (!summary[key]) {
                summary[key] = {};
            }
            if (!summary[key][colorKey]) {
                summary[key][colorKey] = 0;
            }
            summary[key][colorKey]++;
        });

        const summaryElement = document.getElementById('boxCount');
        summaryElement.innerHTML = '';
        
        // Sort sizes by width x height
        const sortedSizes = Object.keys(summary).sort((a, b) => {
            const [aWidth, aHeight] = a.split('x').map(Number);
            const [bWidth, bHeight] = b.split('x').map(Number);
            return (aWidth * aHeight) - (bWidth * bHeight);
        });

        // Create a table for the summary
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';

        sortedSizes.forEach(size => {
            const row = document.createElement('tr');
            
            // Size cell
            const sizeCell = document.createElement('td');
            sizeCell.style.padding = '4px';
            sizeCell.style.borderBottom = '1px solid #eee';
            sizeCell.style.width = '60px';
            sizeCell.textContent = size;
            row.appendChild(sizeCell);
            
            // Colors cell
            const colorsCell = document.createElement('td');
            colorsCell.style.padding = '4px';
            colorsCell.style.borderBottom = '1px solid #eee';
            
            Object.entries(summary[size]).forEach(([color, count]) => {
                const colorBox = document.createElement('span');
                colorBox.style.display = 'inline-block';
                colorBox.style.width = '15px';
                colorBox.style.height = '15px';
                colorBox.style.backgroundColor = color;
                colorBox.style.border = '1px solid #ccc';
                colorBox.style.marginRight = '4px';
                colorBox.style.position = 'relative';
                colorBox.style.top = '3px';
                
                const countSpan = document.createElement('span');
                countSpan.textContent = ` x${count} `;
                countSpan.style.marginRight = '8px';
                
                colorsCell.appendChild(colorBox);
                colorsCell.appendChild(countSpan);
            });
            
            row.appendChild(colorsCell);
            table.appendChild(row);
        });

        // Add total count
        const totalBoxes = Object.values(summary).reduce((total, colors) => 
            total + Object.values(colors).reduce((sum, count) => sum + count, 0), 0);
        
        const totalRow = document.createElement('tr');
        totalRow.style.borderTop = '2px solid #ccc';
        totalRow.style.fontWeight = 'bold';
        
        const totalLabel = document.createElement('td');
        totalLabel.textContent = 'Total';
        totalLabel.style.padding = '4px';
        
        const totalCount = document.createElement('td');
        totalCount.textContent = totalBoxes;
        totalCount.style.padding = '4px';
        
        totalRow.appendChild(totalLabel);
        totalRow.appendChild(totalCount);
        table.appendChild(totalRow);

        summaryElement.appendChild(table);
    }

    showGhostBox(pos) {
        this.draw(); // Redraw existing boxes
        
        this.ctx.globalAlpha = 0.5;
        const size = this.draggedSize || this.selectedBox;
        
        // Check if position is valid
        const isValid = this.isValidPosition({
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height
        });

        // Create temporary box object for drawing
        const ghostBox = {
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
            color: isValid ? this.selectedColor : 'red'
        };

        this.drawBoxWithBumps(ghostBox);
        this.ctx.globalAlpha = 1.0;
    }

    removeGhostBox() {
        this.draw();
    }

    isValidPosition(box) {
        const size = this.draggedSize || box;
        // Convert size to grid units using the exact formula: 0.5 + (size × 0.5)
        const actualWidth = 0.5 + (size.width * 0.5);
        const actualHeight = 0.5 + (size.height * 0.5);
        const gridWidth = actualWidth * 2; // Convert to grid units
        const gridHeight = actualHeight * 2;
        
        // Check canvas bounds
        if (box.x < 0 || box.y < 0 || 
            box.x + gridWidth > this.canvas.width / this.gridSize ||
            box.y + gridHeight > this.canvas.height / this.gridSize) {
            return false;
        }

        // Check overlap with existing boxes
        for (const existingBox of this.boxes) {
            // Skip checking against itself when moving
            if (existingBox === this.selectedBox) continue;
            
            // Convert existing box size to grid units using the same formula
            const existingGridWidth = (0.5 + (existingBox.width * 0.5)) * 2;
            const existingGridHeight = (0.5 + (existingBox.height * 0.5)) * 2;
            
            if (!(box.x + gridWidth <= existingBox.x ||
                box.x >= existingBox.x + existingGridWidth ||
                box.y + gridHeight <= existingBox.y ||
                box.y >= existingBox.y + existingGridHeight)) {
                return false;
            }
        }

        return true;
    }

    findBoxAt(pos) {
        return this.boxes.find(box => {
            // Convert box dimensions to grid units using the formula
            const gridWidth = (0.5 + (box.width * 0.5)) * 2;
            const gridHeight = (0.5 + (box.height * 0.5)) * 2;
            
            return pos.x >= box.x && 
                   pos.x < box.x + gridWidth && 
                   pos.y >= box.y && 
                   pos.y < box.y + gridHeight;
        });
    }

    setupContextMenu() {
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const pos = this.getGridPosition(e);
            const clickedBox = this.findBoxAt(pos);
            
            if (clickedBox) {
                this.deleteBox(clickedBox);
                this.draw();
                this.updateSummary();
            }
        });
    }

    deleteBox(box) {
        const index = this.boxes.indexOf(box);
        if (index > -1) {
            this.boxes.splice(index, 1);
        }
    }

    drawTrashIcon() {
        const x = this.canvas.width - this.trashZone.width;
        const y = this.canvas.height - this.trashZone.height;
        
        this.ctx.save();
        
        // Draw trash can background
        this.ctx.strokeStyle = '#ff4444';
        this.ctx.fillStyle = this.isTrashHovered ? '#ffeeee' : 'white';
        this.ctx.lineWidth = 2;
        
        // Draw container
        this.ctx.beginPath();
        this.ctx.rect(x, y, this.trashZone.width, this.trashZone.height);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Draw trash can icon (original version)
        this.ctx.strokeStyle = '#ff4444';
        this.ctx.fillStyle = '#ff4444';
        
        const padding = this.gridSize * 0.3; // Larger padding for bigger icon
        const ix = x + padding;
        const iy = y + padding;
        const iw = this.trashZone.width - (padding * 2);
        const ih = this.trashZone.height - (padding * 2);
        
        // Draw the main can shape
        this.ctx.beginPath();
        this.ctx.moveTo(ix + iw * 0.1, iy + ih * 0.2); // Top left of can
        this.ctx.lineTo(ix + iw * 0.9, iy + ih * 0.2); // Top right of can
        this.ctx.lineTo(ix + iw * 0.8, iy + ih); // Bottom right
        this.ctx.lineTo(ix + iw * 0.2, iy + ih); // Bottom left
        this.ctx.closePath();
        this.ctx.stroke();
        
        // Draw the lid
        this.ctx.beginPath();
        this.ctx.moveTo(ix, iy + ih * 0.15);
        this.ctx.lineTo(ix + iw, iy + ih * 0.15);
        this.ctx.stroke();
        
        // Draw the handle
        this.ctx.beginPath();
        this.ctx.moveTo(ix + iw * 0.35, iy + ih * 0.15);
        this.ctx.lineTo(ix + iw * 0.35, iy);
        this.ctx.lineTo(ix + iw * 0.65, iy);
        this.ctx.lineTo(ix + iw * 0.65, iy + ih * 0.15);
        this.ctx.stroke();
        
        // Draw vertical lines on the can
        const stripes = 3;
        const stripeSpacing = ih * 0.6 / stripes;
        const stripeStart = iy + ih * 0.3;
        
        for (let i = 0; i <= stripes; i++) {
            const sy = stripeStart + (i * stripeSpacing);
            const leftX = ix + iw * 0.2 + (iw * 0.6 * (i / stripes) * 0.1);
            const rightX = ix + iw * 0.8 - (iw * 0.6 * (i / stripes) * 0.1);
            
            this.ctx.beginPath();
            this.ctx.moveTo(leftX, sy);
            this.ctx.lineTo(rightX, sy);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    isInTrashZone(pos) {
        const trashX = this.canvas.width - this.trashZone.width;
        const trashY = this.canvas.height - this.trashZone.height;
        
        const mouseX = pos.x * this.gridSize;
        const mouseY = pos.y * this.gridSize;
        
        return mouseX >= trashX && 
               mouseX <= trashX + this.trashZone.width &&
               mouseY >= trashY && 
               mouseY <= trashY + this.trashZone.height;
    }

    drawBoxWithBumps(box) {
        // Convert box coordinates to pixels using the exact formula
        const pixelX = box.x * this.gridSize;
        const pixelY = box.y * this.gridSize;
        const actualWidth = 0.5 + (box.width * 0.5); // Exact formula
        const actualHeight = 0.5 + (box.height * 0.5); // Exact formula
        const pixelWidth = actualWidth * this.fullGridSize;
        const pixelHeight = actualHeight * this.fullGridSize;

        // Draw the main box
        this.ctx.fillStyle = box.color;
        this.ctx.fillRect(
            pixelX,
            pixelY,
            pixelWidth,
            pixelHeight
        );
        
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeRect(
            pixelX,
            pixelY,
            pixelWidth,
            pixelHeight
        );

        // Draw the bumps
        const bumpRadius = this.gridSize * 0.2; // Size of bump
        const bottomY = pixelY + pixelHeight;
        
        // Determine number of bumps based on width
        const numBumps = box.width <= 1 ? 2 : (box.width === 2 ? 3 : 4);
        
        // Calculate spacing between bumps
        const spacing = pixelWidth / (numBumps + 1);
        
        this.ctx.beginPath();
        for (let i = 1; i <= numBumps; i++) {
            const bumpX = pixelX + (spacing * i);
            
            // Draw semicircle bump
            this.ctx.arc(
                bumpX,
                bottomY,
                bumpRadius,
                0,
                Math.PI,
                true
            );
        }
        this.ctx.fillStyle = '#000';
        this.ctx.fill();
    }
}

// Initialize the designer when the page loads
window.addEventListener('load', () => {
    new TonieWallDesigner();
}); 