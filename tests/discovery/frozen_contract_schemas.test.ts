import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { Validator } = require('jsonschema') as { Validator: new () => {
  validate: (instance: unknown, schema: unknown) => { valid: boolean; errors: Array<{ stack: string }> } } };
const schema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'schemas', 'flywheel-recovery', 'v1',
  'contracts.schema.json'), 'utf8'));
const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures',
  'flywheel_recovery_contracts_v1.json'), 'utf8'));

test('frozen recovery v1 golden contracts satisfy the versioned JSON schema', () => {
  const result = new Validator().validate(fixture, schema);
  assert.equal(result.valid, true, result.errors.map((row) => row.stack).join('\n'));
});

test('frozen recovery schema rejects unlocked evidence and incomplete authorizations', () => {
  const unlocked = structuredClone(fixture); unlocked.paperOutcome.liveExecution = 'enabled';
  assert.equal(new Validator().validate(unlocked, schema).valid, false);
  const incomplete = structuredClone(fixture); delete incomplete.executionAuthorization.quoteReference;
  assert.equal(new Validator().validate(incomplete, schema).valid, false);
});
