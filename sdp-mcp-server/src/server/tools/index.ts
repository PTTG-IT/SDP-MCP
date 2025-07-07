import type { ToolRegistry } from '../types.js';
import { registerRequestTools } from './requests.js';
import { registerProblemTools } from './problems.js';
import { registerChangeTools } from './changes.js';
import { registerProjectTools } from './projects.js';
import { registerAssetTools } from './assets.js';

/**
 * Register all SDP MCP tools
 */
export function registerAllTools(
  registry: ToolRegistry,
  sdpClientFactory: any
): void {
  // Register tools for each module
  registerRequestTools(registry, sdpClientFactory);
  registerProblemTools(registry, sdpClientFactory);
  registerChangeTools(registry, sdpClientFactory);
  registerProjectTools(registry, sdpClientFactory);
  registerAssetTools(registry, sdpClientFactory);
}

// Export individual registration functions
export {
  registerRequestTools,
  registerProblemTools,
  registerChangeTools,
  registerProjectTools,
  registerAssetTools,
};