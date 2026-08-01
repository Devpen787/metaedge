import { Router } from 'express';
import { buildV5AuthorityStatus } from './status.js';

export const v5Router = Router();

v5Router.get('/api/v5/status', (_req, res) => {
  const status = buildV5AuthorityStatus();
  const brokerClock = status.clocks.find((clock) => clock.id === 'paper_broker_clock_v5');
  const brokerReady = !status.flags.paperIntentsEnabled
    || (brokerClock?.enabled === true && brokerClock.status === 'healthy');
  const healthy = status.liveExecution === 'locked'
    && status.writerAuthority.legacyWriters === 'disabled'
    && status.cutoff != null
    && status.authorityViolations.length === 0
    && brokerReady;
  res.status(healthy ? 200 : 503).json(status);
});
