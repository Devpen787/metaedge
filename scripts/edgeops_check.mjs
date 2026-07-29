import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'docs/edgeops/README.md',
  'docs/edgeops/EDGEOPS_RESEARCH_BRIEF.md',
  'docs/edgeops/EDGEOPS_PROMPT_PACK.md',
  'docs/edgeops/EDGEOPS_CARD_TEMPLATE.md',
  'docs/edgeops/EDGEOPS_PRODUCT_SPEC.md',
  'docs/edgeops/EDGEOPS_OPERATING_LOOP.md',
  'docs/edgeops/EDGEOPS_ARTIFACT_REGISTRY.md',
  'docs/edgeops/source-notes/RESEARCH_RESPONSE_1_BOT_HEURISTICS.md',
  'docs/edgeops/source-notes/RESEARCH_RESPONSE_2_ALPHA_ARCHITECTURE.md',
  'docs/edgeops/source-notes/SOURCE_LEDGER_BATCH_1.md',
  'docs/edgeops/source-notes/SOURCE_LEDGER_BATCH_2.md',
];

const requiredResearchCards = [
  'regime-first-rsi-reclaim-v1',
  'volume-spike-fraud-filter-v1',
  'unlock-risk-disqualifier-v1',
  'sentiment-attention-vs-entry-v1',
  'autopilot-24h-change-baseline-v1',
  'exit-logic-dominates-entry-v1',
  'htf-momentum-baseline-v1',
  'funding-oi-crowding-filter-v1',
  'liquidity-first-disqualifier-v1',
  'cvd-order-flow-divergence-v1',
  'sell-the-news-exit-liquidity-v1',
  'agent-exposure-cap-human-approval-v1',
  'r-multiple-plan-adherence-journal-v1',
];

const requiredPrompts = [
  'Signal Research Card Prompt',
  'Paper Trade Thesis Prompt',
  'Catalyst Review Prompt',
  'Sentiment And Manipulation Review Prompt',
  'Regime Classification Prompt',
  'Backtest Critique Prompt',
  'Post-Trade Review Prompt',
  'Weekly Edge Report Prompt',
];

const requiredSpecFields = [
  'exitThesis',
  'plannedExitReason',
  'eventStage',
  'orderFlowState',
  'invalidationsOverridden',
  'plannedR',
  'executionAssumption',
  'benchmarkFamily',
  'approvalRequired',
  'realizedR',
  'planAdherence',
];

const failures = [];

function read(relPath) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) {
    failures.push(`missing file: ${relPath}`);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

for (const file of requiredFiles) read(file);

const brief = read('docs/edgeops/EDGEOPS_RESEARCH_BRIEF.md');
for (const card of requiredResearchCards) {
  if (!brief.includes(card)) failures.push(`missing research card in brief: ${card}`);
}

const promptPack = read('docs/edgeops/EDGEOPS_PROMPT_PACK.md');
for (const promptName of requiredPrompts) {
  if (!promptPack.includes(promptName)) failures.push(`missing prompt: ${promptName}`);
}

const productSpec = read('docs/edgeops/EDGEOPS_PRODUCT_SPEC.md');
for (const field of requiredSpecFields) {
  if (!productSpec.includes(field)) failures.push(`missing product spec field: ${field}`);
}

for (const ledger of [
  'docs/edgeops/source-notes/SOURCE_LEDGER_BATCH_1.md',
  'docs/edgeops/source-notes/SOURCE_LEDGER_BATCH_2.md',
]) {
  const text = read(ledger);
  const urlCount = (text.match(/https?:\/\//g) || []).length;
  if (urlCount < 10) failures.push(`${ledger} has too few durable URLs: ${urlCount}`);
}

const operatingLoop = read('docs/edgeops/EDGEOPS_OPERATING_LOOP.md');
for (const required of ['Source Intake', 'Research Card', 'Paper Test', 'Trade Thesis', 'Post-Trade Review', 'Weekly Edge Report']) {
  if (!operatingLoop.includes(required)) failures.push(`missing operating loop section: ${required}`);
}

if (failures.length) {
  console.error('[edgeops:check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[edgeops:check] ok');
console.log(`files: ${requiredFiles.length}`);
console.log(`research cards: ${requiredResearchCards.length}`);
console.log(`prompts: ${requiredPrompts.length}`);
console.log(`spec fields: ${requiredSpecFields.length}`);
