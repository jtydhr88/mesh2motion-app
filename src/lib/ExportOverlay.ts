/**
 * ExportOverlay - Export crop box component for ComfyUI image export
 * Based on free-pose-editor's ExportOverlay implementation
 *
 * Features:
 * - Draggable crop box
 * - Resizable with edge handles (top, bottom, left, right)
 * - Real-time size display
 * - Export to ComfyUI callback
 */

export interface ExportSize {
  width: number
  height: number
}

export interface CropPosition {
  left: number
  top: number
  width: number
  height: number
}

export class ExportOverlay {
  private isOpen: boolean = false
  private exportWidth: number = 512
  private exportHeight: number = 512

  // Drag state
  private currentDragTarget: HTMLElement | null = null
  private startX: number = 0
  private startY: number = 0
  private dragOffsetX: number = 0
  private dragOffsetY: number = 0

  // DOM element references
  private overlayContainer: HTMLDivElement | null = null
  private cropBox: HTMLDivElement | null = null
  private controlsPanel: HTMLDivElement | null = null
  private dragLines: Record<string, HTMLDivElement> = {}
  private dragIcon: HTMLDivElement | null = null

  // Bound event handlers
  private _onDragMoveBound: ((e: PointerEvent) => void) | null = null
  private _onDragEndBound: ((e: PointerEvent) => void) | null = null

  // Callbacks
  private exportCallback: ((type: string) => void) | null = null

  constructor() {
    this._createDOM()
    this._bindEvents()
  }

  /**
   * Create DOM structure
   */
  private _createDOM(): void {
    // Main container
    this.overlayContainer = document.createElement('div')
    this.overlayContainer.className = 'export-overlay-container'
    this.overlayContainer.style.display = 'none'

    // Close button
    const closeButton = document.createElement('div')
    closeButton.className = 'export-overlay-close'
    closeButton.innerHTML = '✕'
    closeButton.onclick = () => this.close()
    this.overlayContainer.appendChild(closeButton)

    // Crop box
    this.cropBox = document.createElement('div')
    this.cropBox.className = 'export-crop-box'
    this.overlayContainer.appendChild(this.cropBox)

    // Four drag lines
    const dragTopLine = document.createElement('div')
    dragTopLine.className = 'export-drag-line export-drag-top'
    dragTopLine.dataset.direction = 'top'
    this.cropBox.appendChild(dragTopLine)
    this.dragLines.top = dragTopLine

    const dragBottomLine = document.createElement('div')
    dragBottomLine.className = 'export-drag-line export-drag-bottom'
    dragBottomLine.dataset.direction = 'bottom'
    this.cropBox.appendChild(dragBottomLine)
    this.dragLines.bottom = dragBottomLine

    const dragLeftLine = document.createElement('div')
    dragLeftLine.className = 'export-drag-line export-drag-left'
    dragLeftLine.dataset.direction = 'left'
    this.cropBox.appendChild(dragLeftLine)
    this.dragLines.left = dragLeftLine

    const dragRightLine = document.createElement('div')
    dragRightLine.className = 'export-drag-line export-drag-right'
    dragRightLine.dataset.direction = 'right'
    this.cropBox.appendChild(dragRightLine)
    this.dragLines.right = dragRightLine

    // Center drag icon
    const dragIcon = document.createElement('div')
    dragIcon.className = 'export-drag-icon'
    dragIcon.innerHTML = '⊕'
    dragIcon.dataset.direction = 'move'
    this.cropBox.appendChild(dragIcon)
    this.dragIcon = dragIcon

    // Controls panel
    this.controlsPanel = document.createElement('div')
    this.controlsPanel.className = 'export-controls-panel'
    this.controlsPanel.innerHTML = `
      <h3>Save to ComfyUI</h3>
      <div class="export-control-row">
        <label>Width:</label>
        <input type="number" id="exportWidth" min="1" value="${this.exportWidth}">
      </div>
      <div class="export-control-row">
        <label>Height:</label>
        <input type="number" id="exportHeight" min="1" value="${this.exportHeight}">
      </div>
      <div class="export-size-presets">
        <button class="preset-btn" data-width="512" data-height="512">512×512</button>
        <button class="preset-btn" data-width="768" data-height="768">768×768</button>
        <button class="preset-btn" data-width="1024" data-height="1024">1024×1024</button>
      </div>
      <div class="export-buttons">
        <button id="btnExportToComfyUI" class="primary-export-btn">Save to ComfyUI</button>
        <button id="btnCloseCrop" class="secondary-export-btn">Cancel</button>
      </div>
    `
    this.overlayContainer.appendChild(this.controlsPanel)

    // Add to page
    document.body.appendChild(this.overlayContainer)

    // Update initial size
    this._updateCropBoxSize()
  }

  /**
   * Bind events
   */
  private _bindEvents(): void {
    // Drag line events
    Object.values(this.dragLines).forEach(line => {
      line.addEventListener('pointerdown', (e) => this._onDragStart(e))
    })

    // Drag icon event
    if (this.dragIcon) {
      this.dragIcon.addEventListener('pointerdown', (e) => this._onDragStart(e))
    }

    if (!this.controlsPanel) return

    // Input events
    const widthInput = this.controlsPanel.querySelector('#exportWidth') as HTMLInputElement
    const heightInput = this.controlsPanel.querySelector('#exportHeight') as HTMLInputElement

    widthInput?.addEventListener('input', (e) => {
      this.exportWidth = Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1)
      this._updateCropBoxSize()
    })

    heightInput?.addEventListener('input', (e) => {
      this.exportHeight = Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1)
      this._updateCropBoxSize()
    })

    // Preset buttons
    const presetBtns = this.controlsPanel.querySelectorAll('.preset-btn')
    presetBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement
        const width = parseInt(target.dataset.width || '512')
        const height = parseInt(target.dataset.height || '512')
        this.exportWidth = width
        this.exportHeight = height
        widthInput.value = String(width)
        heightInput.value = String(height)
        this._updateCropBoxSize()
      })
    })

    // Close button event
    const closeBtn = this.controlsPanel.querySelector('#btnCloseCrop')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close())
    }
  }

  /**
   * Start drag
   */
  private _onDragStart(event: PointerEvent): void {
    event.preventDefault()
    event.stopPropagation()

    this.currentDragTarget = event.target as HTMLElement
    this.startX = event.clientX
    this.startY = event.clientY

    const direction = this.currentDragTarget.dataset.direction

    // If moving the whole box, calculate offset from center
    if (direction === 'move' && this.cropBox) {
      const rect = this.cropBox.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      this.dragOffsetX = event.clientX - centerX
      this.dragOffsetY = event.clientY - centerY
    }

    // Bind move and end events
    this._onDragMoveBound = (e) => this._onDragMove(e)
    this._onDragEndBound = (e) => this._onDragEnd(e)
    document.addEventListener('pointermove', this._onDragMoveBound)
    document.addEventListener('pointerup', this._onDragEndBound)

    // Change cursor
    document.body.style.cursor = 'grabbing'
  }

  /**
   * Drag move
   */
  private _onDragMove(event: PointerEvent): void {
    event.preventDefault()

    if (!this.currentDragTarget || !this.cropBox || !this.controlsPanel) return

    const direction = this.currentDragTarget.dataset.direction

    if (direction === 'move') {
      // Move whole box - calculate new center position
      const newCenterX = event.clientX - this.dragOffsetX
      const newCenterY = event.clientY - this.dragOffsetY

      // CSS has left:50%, top:50%, transform:translate(-50%,-50%)
      // So calculate offset from screen center
      const screenCenterX = window.innerWidth / 2
      const screenCenterY = window.innerHeight / 2

      const offsetFromCenter = {
        x: newCenterX - screenCenterX,
        y: newCenterY - screenCenterY
      }

      // Use calc() to add offset
      this.cropBox.style.left = `calc(50% + ${offsetFromCenter.x}px)`
      this.cropBox.style.top = `calc(50% + ${offsetFromCenter.y}px)`
    } else {
      // Resize using delta
      const deltaX = event.clientX - this.startX
      const deltaY = event.clientY - this.startY

      this.startX = event.clientX
      this.startY = event.clientY

      // Adjust size
      if (direction === 'top') {
        this.exportHeight -= 2 * deltaY
      } else if (direction === 'bottom') {
        this.exportHeight += 2 * deltaY
      } else if (direction === 'left') {
        this.exportWidth -= 2 * deltaX
      } else if (direction === 'right') {
        this.exportWidth += 2 * deltaX
      }

      // Ensure size is valid
      this.exportWidth = Math.max(50, this.exportWidth)
      this.exportHeight = Math.max(50, this.exportHeight)

      // Update inputs and size
      const widthInput = this.controlsPanel.querySelector('#exportWidth') as HTMLInputElement
      const heightInput = this.controlsPanel.querySelector('#exportHeight') as HTMLInputElement
      if (widthInput) widthInput.value = String(Math.round(this.exportWidth))
      if (heightInput) heightInput.value = String(Math.round(this.exportHeight))
      this._updateCropBoxSize()
    }
  }

  /**
   * Drag end
   */
  private _onDragEnd(event: PointerEvent): void {
    event.preventDefault()

    if (this._onDragMoveBound) {
      document.removeEventListener('pointermove', this._onDragMoveBound)
    }
    if (this._onDragEndBound) {
      document.removeEventListener('pointerup', this._onDragEndBound)
    }

    this.currentDragTarget = null
    document.body.style.cursor = 'default'
  }

  /**
   * Update crop box size
   */
  private _updateCropBoxSize(): void {
    if (!this.cropBox) return

    this.cropBox.style.width = `${this.exportWidth}px`
    this.cropBox.style.height = `${this.exportHeight}px`

    // Update drag line sizes
    if (this.dragLines.top) this.dragLines.top.style.width = `${this.exportWidth / 2}px`
    if (this.dragLines.bottom) this.dragLines.bottom.style.width = `${this.exportWidth / 2}px`
    if (this.dragLines.left) this.dragLines.left.style.height = `${this.exportHeight / 2}px`
    if (this.dragLines.right) this.dragLines.right.style.height = `${this.exportHeight / 2}px`
  }

  /**
   * Open crop box
   */
  public open(): void {
    this.isOpen = true
    if (this.overlayContainer) {
      this.overlayContainer.style.display = 'block'
    }

    // Clear any previous position settings to let CSS default centering work
    if (this.cropBox) {
      this.cropBox.style.left = ''
      this.cropBox.style.top = ''
    }
  }

  /**
   * Close crop box
   */
  public close(): void {
    this.isOpen = false
    if (this.overlayContainer) {
      this.overlayContainer.style.display = 'none'
    }
  }

  /**
   * Toggle show/hide
   */
  public toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  /**
   * Check if overlay is open
   */
  public getIsOpen(): boolean {
    return this.isOpen
  }

  /**
   * Get crop box position (screen coordinates)
   */
  public getPosition(): CropPosition {
    if (!this.cropBox) {
      return { left: 0, top: 0, width: this.exportWidth, height: this.exportHeight }
    }
    const rect = this.cropBox.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    }
  }

  /**
   * Get export size
   */
  public getExportSize(): ExportSize {
    return {
      width: this.exportWidth,
      height: this.exportHeight
    }
  }

  /**
   * Set export callback
   */
  public onExport(callback: (type: string) => void): void {
    this.exportCallback = callback
    if (this.controlsPanel) {
      const exportBtn = this.controlsPanel.querySelector('#btnExportToComfyUI')
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          callback('regular')
        })
      }
    }
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    if (this.overlayContainer && this.overlayContainer.parentNode) {
      this.overlayContainer.parentNode.removeChild(this.overlayContainer)
    }
  }
}
