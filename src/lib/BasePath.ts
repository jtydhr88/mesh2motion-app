/**
 * BasePath utility for ComfyUI integration
 * Handles the base path prefix for all asset URLs
 */

/**
 * Get the base path from the <base> tag or default to '/'
 */
export function getBasePath(): string {
  const baseElement = document.querySelector('base')
  if (baseElement) {
    const href = baseElement.getAttribute('href')
    if (href) {
      // Ensure it ends with /
      return href.endsWith('/') ? href : href + '/'
    }
  }
  return '/'
}

/**
 * Resolve a relative path to an absolute path using the base path
 * This function is idempotent - if the path already includes the base path, it won't be added again
 * @param relativePath - The relative path (e.g., 'models/model-human.glb' or '../models/model-human.glb')
 * @returns The absolute path with base prefix
 */
export function resolveAssetPath(relativePath: string): string {
  const basePath = getBasePath()

  // Remove leading ../ or ./
  let cleanPath = relativePath
  while (cleanPath.startsWith('../')) {
    cleanPath = cleanPath.substring(3)
  }
  while (cleanPath.startsWith('./')) {
    cleanPath = cleanPath.substring(2)
  }

  // If path already starts with basePath, return as-is (idempotent)
  if (cleanPath.startsWith(basePath)) {
    return cleanPath
  }

  // If path already starts with '/' and basePath is not just '/', check if it's absolute
  if (cleanPath.startsWith('/') && basePath !== '/') {
    // Path is already absolute, check if it starts with basePath
    if (cleanPath.startsWith(basePath)) {
      return cleanPath
    }
    // Remove leading / and add basePath
    cleanPath = cleanPath.substring(1)
  }

  // Combine base path with clean path
  return basePath + cleanPath
}

/**
 * Check if we're running in ComfyUI mode
 */
export function isComfyUIMode(): boolean {
  const basePath = getBasePath()
  return basePath.includes('mesh2motion')
}
