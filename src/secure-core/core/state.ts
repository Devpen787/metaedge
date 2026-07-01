/**
 * Canonical Record Model
 * Canonical entities, state machine, transitions, invariants.
 */

export type RecordStatus = 'PENDING' | 'ACTIVE' | 'FROZEN' | 'CLOSED' | 'CANCELLED';

export interface RecordEntity {
  id: string;
  status: RecordStatus;
  createdAt: number;
  updatedAt: number;
  version: number;
  metadata: Record<string, any>;
}

export interface StateTransitionResult<T> {
  success: boolean;
  newState?: T;
  error?: string;
}

export function transitionState(
  record: RecordEntity, 
  targetStatus: RecordStatus, 
  validatorFn: (r: RecordEntity) => boolean
): StateTransitionResult<RecordEntity> {
  if (!validatorFn(record)) {
    return { success: false, error: 'Invariant check failed for state transition.' };
  }
  
  return {
    success: true,
    newState: {
      ...record,
      status: targetStatus,
      updatedAt: Date.now(),
      version: record.version + 1
    }
  };
}
