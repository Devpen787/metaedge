import { Router } from 'express';
import { readFactoryStatus, readOpportunityCards, readRelationships } from './store.js';
import { FlywheelLedger } from './flywheel_store.js';
import { controlPlaneSnapshot } from './control_cycle.js';
import { DataWorldStore } from './data_world_store.js';
import { WorldStore } from './world_store.js';
import { SignalResearchStore } from './signal_store.js';
import { LaneSignalStore } from './lane_signal_store.js';
import { CouncilStore } from './council_store.js';
import { ValidationStore } from './validation_store.js';
import { PortfolioOperationStore } from './portfolio_operation_store.js';
import { ForwardLearningStore } from './forward_learning_store.js';
import { buildV3OperatorSnapshot } from './operator_snapshot.js';
import { EconomicOperationStore } from './economic_store.js';

export const discoveryRouter = Router();

discoveryRouter.get('/api/opportunity-factory/status', (_req, res) => res.json(readFactoryStatus()));
discoveryRouter.get('/api/opportunity-factory/cards', (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
  res.json({ mode: 'Paper research', liveExecution: 'locked', cards: readOpportunityCards(limit) });
});
discoveryRouter.get('/api/opportunity-factory/relationships', (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
  res.json({ mode: 'Paper research', liveExecution: 'locked', relationships: readRelationships(limit) });
});
discoveryRouter.get('/api/opportunity-factory/flywheel', (_req, res) => res.json(new FlywheelLedger().snapshot()));
discoveryRouter.get('/api/opportunity-factory/control', (_req, res) => res.json(controlPlaneSnapshot()));
discoveryRouter.get('/api/opportunity-factory/data-world', (_req, res) => res.json(new DataWorldStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/world', (_req, res) => res.json(new WorldStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/signals', (_req, res) => res.json(new SignalResearchStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/lane-signals', (_req, res) => res.json(new LaneSignalStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/council', (_req, res) => res.json(new CouncilStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/validation', (_req, res) => res.json(new ValidationStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/portfolio-execution', (_req, res) => res.json(new PortfolioOperationStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/forward-learning', (_req, res) => res.json(new ForwardLearningStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/economics', (_req, res) => res.json(new EconomicOperationStore().snapshot()));
discoveryRouter.get('/api/opportunity-factory/v3', (_req, res) => res.json(buildV3OperatorSnapshot()));
