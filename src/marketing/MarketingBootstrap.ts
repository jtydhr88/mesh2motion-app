import { getComfyUIIntegration } from '../lib/ComfyUIIntegration'
import { Vector3 } from 'three'
import { ProcessStep } from '../lib/enums/ProcessStep'
import { SkeletonType } from '../lib/enums/SkeletonType'
import { Mesh2MotionEngine } from '../Mesh2MotionEngine'
import { resolveAssetPath } from '../lib/BasePath'

export class MarketingBootstrap {
  private mesh2motion_engine: Mesh2MotionEngine
  private skeleton_type: SkeletonType = SkeletonType.None

  constructor () {
    this.mesh2motion_engine = new Mesh2MotionEngine()
    
    // Register engine with ComfyUI integration
    const comfyUIIntegration = getComfyUIIntegration()
    comfyUIIntegration.setEngine(this.mesh2motion_engine)
    this.add_event_listeners()

    // default: X:0 (centered), Y:1.7 (eye-level), Z:5 (front view)
    // view can be changed to a bit higher looking down at an angle
    const tilted_camera_angle_position = new Vector3().set(6, 5, 11)
    this.mesh2motion_engine.set_camera_position(tilted_camera_angle_position)
  }

  private change_active_skeleton (active_dom_button: HTMLElement): void {
    // remove the active classes from all buttons in .model-selection-section
    const model_buttons = document.querySelectorAll('.model-selection-section button')
    model_buttons.forEach((button) => {
      button.classList.remove('active-button')
    })

    active_dom_button.classList.add('active-button')
  }

  public setup_model_buttons (): void {
    // add click events for each button type
    const human_button: HTMLElement | null = document.getElementById('load-human-model-button')
    const fox_button: HTMLElement | null = document.getElementById('load-fox-model-button')
    const bird_button: HTMLElement | null = document.getElementById('load-bird-model-button')
    const dragon_button: HTMLElement | null = document.getElementById('load-dragon-model-button')

    human_button?.addEventListener('click', () => {
      this.mesh2motion_engine.load_model_step.clear_loaded_model_data()
      this.mesh2motion_engine.load_model_step.load_model_file(resolveAssetPath('models/model-human.glb'), 'glb')
      this.skeleton_type = SkeletonType.Human
      this.change_active_skeleton(human_button)
    })

    fox_button?.addEventListener('click', () => {
      this.mesh2motion_engine.load_model_step.clear_loaded_model_data()
      this.mesh2motion_engine.load_model_step.load_model_file(resolveAssetPath('models/model-fox.glb'), 'glb')
      this.skeleton_type = SkeletonType.Quadraped
      this.change_active_skeleton(fox_button)
    })

    bird_button?.addEventListener('click', () => {
      this.mesh2motion_engine.load_model_step.clear_loaded_model_data()
      this.mesh2motion_engine.load_model_step.load_model_file(resolveAssetPath('models/model-bird.glb'), 'glb')
      this.skeleton_type = SkeletonType.Bird
      this.change_active_skeleton(bird_button)
    })

    dragon_button?.addEventListener('click', () => {
      this.mesh2motion_engine.load_model_step.clear_loaded_model_data()
      this.mesh2motion_engine.load_model_step.load_model_file(resolveAssetPath('models/model-dragon.glb'), 'glb')
      this.skeleton_type = SkeletonType.Dragon
      this.change_active_skeleton(dragon_button)
    })

    human_button?.click() // load human by default to start us out
  }

  public add_event_listeners (): void {
    // event after the DOM is fully loaded for HTML elements
    document.addEventListener('DOMContentLoaded', () => {
      this.setup_model_buttons() // automatically trigger the human once we begin for the default
    }) // end the DOMContentLoaded function

    // we are re-creating the engine, so need to manually add the event listeners again
    this.mesh2motion_engine.load_model_step.addEventListener('modelLoaded', () => {
      // this (this.skeleton_type) value contains the filename for the skeleton rig
      this.mesh2motion_engine.process_step_changed(ProcessStep.LoadSkeleton)
      this.mesh2motion_engine.load_skeleton_step.load_skeleton_file(this.skeleton_type)
      this.mesh2motion_engine.load_skeleton_step.set_skeleton_type(this.skeleton_type)
    })

    // need to automatically finish the edit skeleton step and move onto the next step
    this.mesh2motion_engine.load_skeleton_step.addEventListener('skeletonLoaded', () => {
      this.mesh2motion_engine.animations_listing_step.set_animations_file_path('animations/')
      this.mesh2motion_engine.process_step_changed(ProcessStep.BindPose)
    })
  }
}

// instantiate the class to setup event listeners
const app = new MarketingBootstrap()
