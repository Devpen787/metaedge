/**
 * Role-based data views and public-closeout projection.
 */
import { RecordEntity } from '../core/state';
import { Role } from '../policy/rbac';

export function projectRecordForRole(record: RecordEntity, role: Role): Partial<RecordEntity> {
  // Privacy-by-default: only expose necessary fields
  const baseProjection = {
    id: record.id,
    status: record.status,
    updatedAt: record.updatedAt,
  };

  switch (role) {
    case 'ORGANIZER':
      // Organizer gets full view
      return { ...record };
    case 'PAYER':
    case 'RECEIVER':
      // Participants get limited metadata
      return { 
        ...baseProjection, 
        metadata: {
          publicInfo: record.metadata?.publicInfo
        } 
      };
    case 'OBSERVER':
    default:
      // Observers only get base projection
      return baseProjection;
  }
}
