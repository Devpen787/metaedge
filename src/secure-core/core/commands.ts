/**
 * Domain commands + transition rules + idempotency.
 */
import { RecordEntity } from './state';
import { logAuditEvent } from '../audit/logger';

export interface CommandContext {
  actorId: string;
  requestId: string;
  observedAt: number;
}

export interface Command<T> {
  type: string;
  payload: T;
  context: CommandContext;
}

const processedCommands = new Set<string>();

export function executeCommand<T>(
  command: Command<T>,
  record: RecordEntity,
  handler: (cmd: Command<T>, rec: RecordEntity) => RecordEntity
): RecordEntity {
  // Idempotency check
  if (processedCommands.has(command.context.requestId)) {
    console.warn(`[Command] Duplicate request ignored: ${command.context.requestId}`);
    return record; // Return unchanged state
  }

  try {
    const newState = handler(command, record);
    
    // Mark as processed
    processedCommands.add(command.context.requestId);
    
    // Log audit event
    logAuditEvent({
      actor: command.context.actorId,
      action: command.type,
      target: record.id,
      requestId: command.context.requestId,
      payloadHash: JSON.stringify(command.payload).length.toString(), // Simple hash proxy
      timestamp: Date.now()
    });

    return newState;
  } catch (error: any) {
    throw new Error(`Command execution failed: ${error.message}`);
  }
}
