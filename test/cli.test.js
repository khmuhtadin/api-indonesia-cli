import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/cli.js';
import { table } from '../src/format.js';

test('parseArgs splits positionals, flags and params', () => {
  const r = parseArgs(['libur', '--tahun', '2026', '--json', '--param', 'a=1', '-p', 'b=2']);
  assert.deepEqual(r.positional, ['libur']);
  assert.equal(r.flags.tahun, '2026');
  assert.equal(r.flags.json, true);
  assert.deepEqual(r.params, ['a=1', 'b=2']);
});

test('boolean flags do not swallow the next positional', () => {
  const r = parseArgs(['libur', '--upcoming', 'x']);
  assert.equal(r.flags.upcoming, true);
  assert.deepEqual(r.positional, ['libur', 'x']);
});

test('table renders header and rows', () => {
  const out = table([{ id: '11', name: 'Aceh' }], ['id', 'name']);
  assert.match(out, /^id\s+name/);
  assert.match(out, /11\s+Aceh/);
});
