export function automaticPauseReason({ stage, sample, recent, intervalMs, projectedTotalKbPerDay, v3p95Ms }) {
  if (sample.health.currentLiveLock === false || sample.v3.liveExecution !== 'locked'
    || (sample.v3.criticalFailures ?? 0) > 0) return 'INTEGRITY_FAILED';
  if (sample.health.operational !== true) return 'OPERATIONAL_HEALTH_DEGRADED';
  if (stage === 'final' && sample.health.eventAgeMs != null && sample.health.eventAgeMs > 30_000) {
    return 'EVENT_LAG_EXCEEDED_30S';
  }
  if (recent.length * intervalMs >= 5 * 60_000 && v3p95Ms != null && v3p95Ms > 500) {
    return 'API_P95_EXCEEDED_500MS_FOR_5M';
  }
  if ((sample.health.clocks || []).some((clock) => Number(clock.queueDepth) > 10_000)) {
    return 'QUEUE_DEPTH_EXCEEDED_10000';
  }
  if (projectedTotalKbPerDay != null && recent.length * intervalMs >= 5 * 60_000
    && projectedTotalKbPerDay > 2 * 1024 * 1024) return 'PROJECTED_DISK_GROWTH_EXCEEDED_2GB_DAY';
  return null;
}
