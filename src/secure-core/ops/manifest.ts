/**
 * Deployment and Config Manifest per Surface
 */

export interface SurfaceManifest {
  surfaceId: string;
  version: string;
  deployedAt: number;
  configHash: string;
  activeFeatures: string[];
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
}

export const CURRENT_MANIFEST: SurfaceManifest = {
  surfaceId: 'METAEDGE_WEB_V1',
  version: '1.0.0-secure',
  deployedAt: Date.now(),
  configHash: 'sha256_mock_hash_of_env',
  activeFeatures: ['TRADING_HUB', 'VAULTS', 'AGENT_ROUTING'],
  environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'
};
