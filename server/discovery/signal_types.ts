import type { FlywheelLane } from './flywheel_types.js';

export type SignalNormalization = 'causal_zscore' | 'causal_robust_zscore';

export interface SignalInputPoint {
  at: number;
  availableAt: number;
  assetReturnBps: number;
  benchmarkReturnBps: number;
  capacityUsd?: number | null;
  sourceEventIds: string[];
}

export interface SignalTransformSpec {
  id: string;
  schemaVersion: 1;
  normalization: SignalNormalization;
  normalizationWindow: number;
  smoothing: 'ema';
  smoothingAlpha: number;
  residualization: 'rolling_ols_beta';
  residualWindow: number;
  calibration: 'training_quantile_laplace';
  calibrationBins: number;
  orientation: 'follow' | 'invert';
  declaredTrials: number;
  liveExecution: 'locked';
}

export interface SignalResearchChoice {
  id: string;
  category: 'parameter_surface' | 'normalization_family' | 'residualization' | 'calibration' | 'horizon_set' | 'orientation';
  description: string;
  actor: 'automated' | 'manual_precommit';
  trialCost: number;
}

export interface SignalPoint extends SignalInputPoint {
  residualized: number | null;
  normalized: number | null;
  smoothed: number | null;
  calibratedProbability: number | null;
}

export interface EventStudyResult {
  split: 'training' | 'validation' | 'holdout';
  horizonBars: number;
  threshold: number;
  direction: 'positive' | 'negative';
  events: number;
  meanRelativeReturnBps: number | null;
  medianRelativeReturnBps: number | null;
  winRate: number | null;
  edgeLowerConfidenceBps: number | null;
}

export interface InformationHorizonPoint {
  split: 'training';
  horizonBars: number;
  samples: number;
  signalReturnCorrelation: number | null;
  meanAbsoluteSignal: number | null;
}

export interface TrafficTransition {
  from: 'bearish' | 'neutral' | 'bullish';
  to: 'bearish' | 'neutral' | 'bullish';
  support: number;
  probability: number;
  meanNextRelativeReturnBps: number | null;
}

export interface ParameterSurfacePoint {
  normalizationWindow: number;
  smoothingAlpha: number;
  eventThreshold: number;
  samples: number;
  trainingScore: number | null;
}

export interface ParameterPlateau {
  bestPoint: ParameterSurfacePoint | null;
  nearBestPoints: ParameterSurfacePoint[];
  plateauFraction: number;
  adjacentNearBestPoints: number;
  toleranceFraction: number;
  robust: boolean;
  reason: string;
}

export interface SignalResearchArtifact {
  id: string;
  schemaVersion: 1;
  researchPolicyVersion: string;
  createdAt: number;
  datasetVersionId: string;
  universeVersionId: string;
  worldContractId: string;
  lane: Extract<FlywheelLane, 'stocks' | 'spot_crypto' | 'memecoins'>;
  symbol: string;
  benchmark: string;
  transform: SignalTransformSpec;
  researchChoices: SignalResearchChoice[];
  points: SignalPoint[];
  eventStudies: EventStudyResult[];
  informationHorizon: InformationHorizonPoint[];
  traffic: TrafficTransition[];
  parameterSurface: ParameterSurfacePoint[];
  plateau: ParameterPlateau;
  methodDisposition: 'promising' | 'rejected' | 'insufficient';
  promotionDisposition: 'forward_candidate' | 'declined' | 'blocked';
  decisionReasons: string[];
  historicalResearchEligible: boolean;
  paperForwardEligible: boolean;
  blockers: string[];
  liveExecution: 'locked';
}
