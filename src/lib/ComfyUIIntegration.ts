/**
 * ComfyUI Integration Module
 * Handles postMessage communication between mesh2motion and ComfyUI parent window
 */

import type { Mesh2MotionEngine } from '../Mesh2MotionEngine'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Scene, type AnimationClip, type SkinnedMesh, type Object3D } from 'three'
import { ExportOverlay } from './ExportOverlay'
import { ImageExporter } from './ImageExporter'

export interface ComfyUIMessage {
  type: string
  data?: Record<string, unknown>
}

export interface ImageExportData {
  imageDataUrl: string
  filename: string
  width: number
  height: number
}

export class ComfyUIIntegration {
  private engine: Mesh2MotionEngine | null = null
  private isComfyUIMode: boolean = false
  private parentOrigin: string = '*'
  private gltfLoader = new GLTFLoader()
  private exportOverlay: ExportOverlay | null = null
  private imageExporter: ImageExporter | null = null

  constructor() {
    this.isComfyUIMode = this.detectComfyUIMode()
    if (this.isComfyUIMode) {
      this.setupMessageListener()
      this.initializeImageExport()
    }
  }

  private initializeImageExport(): void {
    this.exportOverlay = new ExportOverlay()
    this.exportOverlay.onExport((type) => {
      this.handleImageExport(type)
    })
  }

  /**
   * Detect if we're running inside ComfyUI iframe
   */
  private detectComfyUIMode(): boolean {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('comfyui') === 'true'
  }

  /**
   * Check if running in ComfyUI mode
   */
  public isInComfyUIMode(): boolean {
    return this.isComfyUIMode
  }

  /**
   * Set the engine reference for accessing mesh2motion functionality
   */
  public setEngine(engine: Mesh2MotionEngine): void {
    console.log('[Mesh2Motion ComfyUI Integration] setEngine called, isComfyUIMode:', this.isComfyUIMode)
    this.engine = engine

    if (this.isComfyUIMode) {
      this.imageExporter = new ImageExporter(engine.scene, engine.camera, engine.renderer)
    }

    // Notify parent that we're ready
    this.sendReadyMessage()
  }

  /**
   * Setup message listener for parent window communication
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event: MessageEvent) => {
      this.handleMessage(event)
    })
  }

  /**
   * Handle incoming messages from ComfyUI parent
   */
  private handleMessage(event: MessageEvent): void {
    const message = event.data as ComfyUIMessage
    if (!message || typeof message.type !== 'string') {
      return
    }

    console.log('[Mesh2Motion ComfyUI Integration] Received message:', message.type, message.data)

    switch (message.type) {
      case 'comfyui:loadModel':
        this.handleLoadModel(message.data as { url: string })
        break

      case 'comfyui:requestExport':
        this.handleExportRequest()
        break

      case 'comfyui:requestImageExport':
        this.handleRequestImageExport()
        break

      case 'comfyui:setTheme':
        this.handleSetTheme(message.data as { theme: 'light' | 'dark' })
        break

      default:
        console.log('[Mesh2Motion] Unknown message type:', message.type)
    }
  }

  /**
   * Send message to parent window
   */
  private sendMessage(type: string, data?: Record<string, unknown>): void {
    if (!window.parent || window.parent === window) {
      return
    }

    window.parent.postMessage({ type, data }, this.parentOrigin)
  }

  /**
   * Notify parent that mesh2motion is ready
   */
  private sendReadyMessage(): void {
    this.sendMessage('mesh2motion:ready')
  }

  /**
   * Handle model load request from ComfyUI
   */
  private async handleLoadModel(data: { url: string }): Promise<void> {
    console.log('[Mesh2Motion ComfyUI Integration] handleLoadModel called with:', data)

    if (!data?.url || !this.engine) {
      console.error('[Mesh2Motion ComfyUI Integration] Invalid model URL or engine not initialized', { url: data?.url, engine: !!this.engine })
      this.sendMessage('mesh2motion:error', { message: 'Invalid model URL or engine not initialized' })
      return
    }

    try {
      console.log('[Mesh2Motion ComfyUI Integration] Fetching model from:', data.url)
      // Fetch the model data
      const response = await fetch(data.url)
      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      console.log('[Mesh2Motion ComfyUI Integration] Model fetched, size:', arrayBuffer.byteLength)

      // Determine file type from URL
      const url = data.url.toLowerCase()
      let fileExtension = 'glb'
      if (url.includes('.gltf')) {
        fileExtension = 'gltf'
      } else if (url.includes('.fbx')) {
        fileExtension = 'fbx'
      }
      console.log('[Mesh2Motion ComfyUI Integration] Detected file extension:', fileExtension)

      // Load the model using the engine's load model step
      const dataUrl = this.arrayBufferToDataUrl(arrayBuffer, fileExtension)
      console.log('[Mesh2Motion ComfyUI Integration] Loading model into engine...')
      this.engine.load_model_step.load_model_file(dataUrl, fileExtension)

      this.sendMessage('mesh2motion:modelLoaded')
    } catch (error) {
      console.error('[Mesh2Motion ComfyUI Integration] Failed to load model:', error)
      this.sendMessage('mesh2motion:error', {
        message: error instanceof Error ? error.message : 'Failed to load model'
      })
    }
  }

  /**
   * Convert ArrayBuffer to data URL (base64 encoded)
   */
  private arrayBufferToDataUrl(buffer: ArrayBuffer, extension: string): string {
    const mimeTypes: Record<string, string> = {
      glb: 'model/gltf-binary',
      gltf: 'model/gltf+json',
      fbx: 'application/octet-stream'
    }

    const mime = mimeTypes[extension] || 'application/octet-stream'
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    return `data:${mime};base64,${base64}`
  }

  /**
   * Handle export request from ComfyUI
   */
  private async handleExportRequest(): Promise<void> {
    if (!this.engine) {
      this.sendMessage('mesh2motion:error', { message: 'Engine not initialized' })
      return
    }

    try {
      // Get the skinned meshes and animations from the engine
      const skinnedMeshes = this.engine.weight_skin_step?.final_skinned_meshes()
      const animationClips = this.engine.animations_listing_step?.animation_clips() || []

      if (!skinnedMeshes || skinnedMeshes.length === 0) {
        this.sendMessage('mesh2motion:error', { message: 'No skinned meshes to export' })
        return
      }

      // Export the model
      const modelData = await this.exportToGLB(skinnedMeshes, animationClips)
      const filename = `mesh2motion-${Date.now()}.glb`

      this.sendMessage('mesh2motion:export', {
        modelData,
        filename
      })
    } catch (error) {
      console.error('[Mesh2Motion] Export failed:', error)
      this.sendMessage('mesh2motion:error', {
        message: error instanceof Error ? error.message : 'Export failed'
      })
    }
  }

  private handleRequestImageExport(): void {
    if (this.exportOverlay) {
      this.exportOverlay.open()
    }
  }

  private async handleImageExport(type: string): Promise<void> {
    if (!this.engine || !this.imageExporter || !this.exportOverlay) {
      this.sendMessage('mesh2motion:error', { message: 'Export components not initialized' })
      return
    }

    try {
      const exportSize = this.exportOverlay.getExportSize()
      const cropPosition = this.exportOverlay.getPosition()

      const imageDataUrl = await this.imageExporter.exportWithCrop(cropPosition, exportSize)
      const filename = `mesh2motion-${Date.now()}.png`

      this.sendMessage('mesh2motion:imageExport', {
        imageDataUrl,
        filename,
        width: exportSize.width,
        height: exportSize.height
      })

      this.exportOverlay.close()
    } catch (error) {
      console.error('[Mesh2Motion] Image export failed:', error)
      this.sendMessage('mesh2motion:error', {
        message: error instanceof Error ? error.message : 'Image export failed'
      })
    }
  }

  /**
   * Export meshes to GLB format
   */
  private exportToGLB(skinnedMeshes: SkinnedMesh[], animationClips: AnimationClip[]): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const exportScene = new Scene()

      // Save original parents
      const originalParents = new Map<SkinnedMesh, Object3D | null>()

      skinnedMeshes.forEach((mesh) => {
        originalParents.set(mesh, mesh.parent)
        exportScene.add(mesh)
      })

      const exporter = new GLTFExporter()
      const options = {
        binary: true,
        onlyVisible: false,
        embedImages: true,
        animations: animationClips
      }

      exporter.parse(
        exportScene,
        (result) => {
          // Restore original parents
          skinnedMeshes.forEach((mesh) => {
            const originalParent = originalParents.get(mesh)
            if (originalParent) {
              originalParent.add(mesh)
            } else {
              exportScene.remove(mesh)
            }
          })

          resolve(result as ArrayBuffer)
        },
        (error: unknown) => {
          // Restore original parents on error too
          skinnedMeshes.forEach((mesh) => {
            const originalParent = originalParents.get(mesh)
            if (originalParent) {
              originalParent.add(mesh)
            }
          })

          reject(error)
        },
        options
      )
    })
  }

  /**
   * Handle theme change from ComfyUI
   */
  private handleSetTheme(data: { theme: 'light' | 'dark' }): void {
    if (!this.engine || !data?.theme) {
      return
    }

    this.engine.theme_manager.set_theme(data.theme)
    this.engine.regenerate_floor_grid()
  }

  /**
   * Export model and send to ComfyUI (called from UI button)
   */
  public exportToComfyUI(skinnedMeshes: SkinnedMesh[], animationClips: AnimationClip[]): void {
    if (!this.isComfyUIMode) {
      console.warn('[Mesh2Motion] Not in ComfyUI mode, cannot export to ComfyUI')
      return
    }

    this.exportToGLB(skinnedMeshes, animationClips)
      .then((modelData) => {
        const filename = `mesh2motion-${Date.now()}.glb`
        this.sendMessage('mesh2motion:export', {
          modelData,
          filename
        })
      })
      .catch((error) => {
        console.error('[Mesh2Motion] Export to ComfyUI failed:', error)
        this.sendMessage('mesh2motion:error', {
          message: error instanceof Error ? error.message : 'Export failed'
        })
      })
  }

  public openImageExportOverlay(): void {
    if (!this.isComfyUIMode) {
      console.warn('[Mesh2Motion] Not in ComfyUI mode, image export overlay not available')
      return
    }

    if (this.exportOverlay) {
      this.exportOverlay.open()
    }
  }

  public isImageExportOverlayOpen(): boolean {
    return this.exportOverlay?.getIsOpen() ?? false
  }

  public getExportOverlay(): ExportOverlay | null {
    return this.exportOverlay
  }
}

// Singleton instance
let comfyUIIntegration: ComfyUIIntegration | null = null

export function getComfyUIIntegration(): ComfyUIIntegration {
  if (!comfyUIIntegration) {
    comfyUIIntegration = new ComfyUIIntegration()
  }
  return comfyUIIntegration
}
