/**
 * ImageExporter - Captures Three.js scene to image for ComfyUI export
 * Based on free-pose-editor's ExportManager implementation
 */

import type { Scene, Camera, WebGLRenderer } from 'three'
import type { ExportSize, CropPosition } from './ExportOverlay'

export class ImageExporter {
  private scene: Scene
  private camera: Camera
  private renderer: WebGLRenderer

  constructor(scene: Scene, camera: Camera, renderer: WebGLRenderer) {
    this.scene = scene
    this.camera = camera
    this.renderer = renderer
  }

  /**
   * Update references if scene/camera/renderer change
   */
  public updateReferences(scene: Scene, camera: Camera, renderer: WebGLRenderer): void {
    this.scene = scene
    this.camera = camera
    this.renderer = renderer
  }

  /**
   * Export regular image (screenshot of current view)
   */
  public async exportRegularImage(exportSize: ExportSize): Promise<string> {
    return await this._captureScene(exportSize)
  }

  /**
   * Export with custom crop region
   */
  public async exportWithCrop(cropPosition: CropPosition, exportSize: ExportSize): Promise<string> {
    // Store current pixel ratio
    const currentPixelRatio = this.renderer.getPixelRatio()
    this.renderer.setPixelRatio(1)

    // Render full scene
    this.renderer.render(this.scene, this.camera)

    // Get full canvas
    const fullDataURL = this.renderer.domElement.toDataURL('image/png')

    // Create cropped image
    const croppedDataURL = await new Promise<string>((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = exportSize.width
        canvas.height = exportSize.height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(fullDataURL)
          return
        }

        // Crop from specified position
        const cropX = cropPosition.left
        const cropY = cropPosition.top

        ctx.drawImage(
          img,
          cropX, cropY, cropPosition.width, cropPosition.height, // Source rect
          0, 0, exportSize.width, exportSize.height              // Dest rect
        )

        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => resolve(fullDataURL)
      img.src = fullDataURL
    })

    // Restore pixel ratio
    this.renderer.setPixelRatio(currentPixelRatio)

    return croppedDataURL
  }

  /**
   * Capture scene to image
   */
  private async _captureScene(exportSize: ExportSize): Promise<string> {
    // Store current pixel ratio
    const currentPixelRatio = this.renderer.getPixelRatio()

    // Set pixel ratio to 1 for consistent export
    this.renderer.setPixelRatio(1)

    // Render scene
    this.renderer.render(this.scene, this.camera)

    // Get canvas data
    const dataURL = this.renderer.domElement.toDataURL('image/png')

    // If custom export size is specified, resize from center
    if (exportSize && (exportSize.width || exportSize.height)) {
      const canvas = await this._resizeImage(dataURL, exportSize)
      const resizedDataURL = canvas.toDataURL('image/png')

      // Restore pixel ratio
      this.renderer.setPixelRatio(currentPixelRatio)

      return resizedDataURL
    }

    // Restore pixel ratio
    this.renderer.setPixelRatio(currentPixelRatio)

    return dataURL
  }

  /**
   * Resize/crop image from center
   */
  private async _resizeImage(dataURL: string, size: ExportSize): Promise<HTMLCanvasElement> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size.width
        canvas.height = size.height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(canvas)
          return
        }

        // Calculate center crop
        const centerX = img.width / 2 - size.width / 2
        const centerY = img.height / 2 - size.height / 2

        ctx.drawImage(
          img,
          centerX, centerY, size.width, size.height,
          0, 0, size.width, size.height
        )

        resolve(canvas)
      }
      img.onerror = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size.width
        canvas.height = size.height
        resolve(canvas)
      }
      img.src = dataURL
    })
  }

  /**
   * Download image helper (for local use, not ComfyUI)
   */
  public downloadImage(dataURL: string, filename: string = 'mesh2motion-screenshot.png'): void {
    const link = document.createElement('a')
    link.setAttribute('download', filename)
    link.setAttribute('href', dataURL)
    link.click()
  }

  /**
   * Convert data URL to Blob for upload
   */
  public async dataURLToBlob(dataURL: string): Promise<Blob> {
    const response = await fetch(dataURL)
    return response.blob()
  }
}
