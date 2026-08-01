import path from 'node:path';
import { MessageChannel, receiveMessageOnPort, Worker, type MessagePort } from 'node:worker_threads';

export interface PostgresStateSegment {
  key: string;
  value: unknown;
  valueHash: string;
}

export interface PostgresReadResult {
  missing?: boolean;
  unchanged?: boolean;
  revision?: number;
  schemaVersion?: number;
  stateHash?: string;
  segments?: PostgresStateSegment[];
}

export interface PostgresWriteInput {
  expectedRevision: number;
  changedSegments: PostgresStateSegment[];
  deletedKeys: string[];
  stateHash: string;
  stateBytes: number;
  writerId: string;
}

export interface PostgresWriteResult {
  revision: number;
  committedAt: number;
}

interface WorkerReply {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: { message?: string; code?: string; commitState?: 'not_committed' | 'possibly_committed' };
}

let workerClient: {
  worker: Worker;
  port: MessagePort;
  nextId: number;
} | null = null;

function client() {
  if (workerClient) return workerClient;
  const connectionString = process.env.DATABASE_URL || '';
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    throw new Error('POSTGRES_DATABASE_URL_REQUIRED');
  }
  const workerPath = process.env.METAEDGE_POSTGRES_WORKER_PATH
    || path.join(process.cwd(), 'dist', 'postgres_worker.cjs');
  const { port1, port2 } = new MessageChannel();
  const worker = new Worker(workerPath, {
    workerData: {
      connectionString,
      port: port1,
      poolMax: Math.max(1, Math.min(4, Number(process.env.METAEDGE_POSTGRES_POOL_MAX) || 2)),
      statementTimeoutMs: Math.max(1_000, Number(process.env.METAEDGE_POSTGRES_STATEMENT_TIMEOUT_MS) || 15_000),
      idleTimeoutMs: Math.max(1_000, Number(process.env.METAEDGE_POSTGRES_IDLE_TIMEOUT_MS) || 30_000),
    },
    transferList: [port1],
  });
  worker.unref();
  port2.unref();
  workerClient = { worker, port: port2, nextId: 1 };
  return workerClient;
}

function request<T>(command: string, payload: Record<string, unknown> = {}): T {
  const active = client();
  const id = active.nextId++;
  const signal = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const flag = new Int32Array(signal);
  active.port.postMessage({ id, command, payload, signal });
  const timeoutMs = Math.max(2_000, Number(process.env.METAEDGE_POSTGRES_SYNC_TIMEOUT_MS) || 30_000);
  const waitResult = Atomics.wait(flag, 0, 0, timeoutMs);
  if (waitResult === 'timed-out') {
    workerClient = null;
    void active.worker.terminate();
    throw new Error(`POSTGRES_WORKER_TIMEOUT:${command}`);
  }
  const message = receiveMessageOnPort(active.port)?.message as WorkerReply | undefined;
  if (!message || message.id !== id) throw new Error(`POSTGRES_WORKER_PROTOCOL_ERROR:${command}`);
  if (!message.ok) {
    const error = new Error(message.error?.message || `POSTGRES_WORKER_FAILED:${command}`) as Error & {
      code?: string;
      commitState?: 'not_committed' | 'possibly_committed';
    };
    error.code = message.error?.code;
    error.commitState = message.error?.commitState;
    throw error;
  }
  return message.result as T;
}

export function readPostgresState(expectedRevision?: number): PostgresReadResult {
  return request<PostgresReadResult>('read', { expectedRevision });
}

export function writePostgresState(input: PostgresWriteInput): PostgresWriteResult {
  return request<PostgresWriteResult>('write', input as unknown as Record<string, unknown>);
}

export function pingPostgresState(): { schemaVersion: number; revision: number; serverTime: number } {
  return request('ping');
}
