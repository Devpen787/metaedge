import fs from 'node:fs';
import path from 'node:path';
import type { LaneSignalPacket } from './lane_signal_types.js';

function readJsonl<T>(file: string): T[] {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T); } catch { return []; }
}
function appendUnique<T extends { id: string }>(file: string, rows: T[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const known = new Set(readJsonl<T>(file).map((row) => row.id));
  const fresh = rows.filter((row) => { if (known.has(row.id)) return false; known.add(row.id); return true; });
  if (fresh.length) fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

export class LaneSignalStore {
  private readonly packetsFile: string;
  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'lane-signals')) {
    this.packetsFile = path.join(root, 'packets.jsonl');
  }
  appendPackets(rows: LaneSignalPacket[]): void { appendUnique(this.packetsFile, rows); }
  readPackets(): LaneSignalPacket[] { return readJsonl(this.packetsFile); }
  snapshot() {
    const packets = this.readPackets();
    const latest = new Map<string, LaneSignalPacket>();
    for (const packet of packets) latest.set(packet.stream, packet);
    const current = [...latest.values()].sort((left, right) => left.stream.localeCompare(right.stream));
    const invalidPacketIds = packets.filter((packet) => packet.quality.score < 0 || packet.quality.score > 1
      || packet.candidateAction === 'observe_forward' && packet.researchDisposition !== 'forward_candidate').map((packet) => packet.id);
    return { mode: 'Paper research', counts: { packets: packets.length, streams: current.length }, current,
      operatorSummary: { forwardCandidates: current.filter((packet) => packet.researchDisposition === 'forward_candidate').length,
        noTradeStreams: current.filter((packet) => packet.candidateAction === 'no_trade').length,
        researchOnlyStreams: current.filter((packet) => packet.candidateAction === 'research_only').length,
        blockedStreams: current.filter((packet) => packet.evidenceStatus === 'blocked').length },
      integrity: { invalidPacketIds, allLiveExecutionLocked: packets.every((packet) => packet.liveExecution === 'locked') },
      liveExecution: 'locked' as const };
  }
}
