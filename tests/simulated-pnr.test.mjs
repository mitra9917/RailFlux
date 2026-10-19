import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateSimulatedPnr } from '@railflux/shared';

test('generateSimulatedPnr matches RF########## pattern', () => {
  const pnr = generateSimulatedPnr('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.match(pnr, /^RF[0-9]{10}$/);
  assert.equal(generateSimulatedPnr('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), pnr);
});
