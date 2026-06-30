/**
 * Pre-release checklist automation for each new surface.
 */

export interface DeploymentManifest {
  environment: string;
  origins: string[];
  capabilitiesEnabled: string[];
  identityMethods: string[];
  paymentRails: string[];
  commitHash: string;
}

export function verifyDeployment(manifest: DeploymentManifest, expectedConfig: Partial<DeploymentManifest>): boolean {
  // Check environments and allowed origins
  if (expectedConfig.environment && manifest.environment !== expectedConfig.environment) return false;
  
  // Validate capabilities
  if (expectedConfig.capabilitiesEnabled) {
    const hasAll = expectedConfig.capabilitiesEnabled.every(c => manifest.capabilitiesEnabled.includes(c));
    if (!hasAll) return false;
  }

  // Validate identity methods
  if (expectedConfig.identityMethods) {
    const hasAll = expectedConfig.identityMethods.every(c => manifest.identityMethods.includes(c));
    if (!hasAll) return false;
  }

  return true;
}
