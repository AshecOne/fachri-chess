/**
 * Utility functions for the chess application
 */

/**
 * Get the appropriate asset URL based on environment
 * In production (GitHub Pages), use the full GitHub Pages URL
 * In development, use local assets
 */
export function getAssetUrl(path: string): string {
  // Check if we're in production and on GitHub Pages
  const isProduction = process.env.NODE_ENV === 'production';
  const isGitHubPages = typeof window !== 'undefined' && 
    window.location.hostname.includes('github.io');
  
  if (isProduction || isGitHubPages) {
    // Remove leading slash if present for GitHub Pages
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `https://ashecone.github.io/fachri-chess/${cleanPath}`;
  }
  
  // Local development - ensure path starts with /
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Get the appropriate model URL for the chess AI
 */
export function getModelUrl(): string {
  return getAssetUrl('chess_model_quantized.onnx');
}

/**
 * Get the appropriate image URL
 */
export function getImageUrl(filename: string): string {
  return getAssetUrl(filename);
}