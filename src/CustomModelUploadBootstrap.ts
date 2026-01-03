import { Mesh2MotionEngine } from './Mesh2MotionEngine'
import { getComfyUIIntegration } from './lib/ComfyUIIntegration'

export class CustomModelUploadBootstrap {
  private readonly mesh2motion_engine: Mesh2MotionEngine

  constructor () {
    this.mesh2motion_engine = new Mesh2MotionEngine()

    // Register engine with ComfyUI integration to notify parent window we're ready
    const comfyUIIntegration = getComfyUIIntegration()
    comfyUIIntegration.setEngine(this.mesh2motion_engine)
  }
}

// instantiate the class to setup event listeners
const app = new CustomModelUploadBootstrap()
