import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareProbeRouteKind } from '../services/baseline/dist/middleware/compare-probe-calibration.js';

test('compareProbeRouteKind matches v1 search and availability', () => {
  assert.equal(compareProbeRouteKind('/v1/search', 'GET'), 'read');
  assert.equal(compareProbeRouteKind('/search', 'GET'), 'read');
  assert.equal(compareProbeRouteKind('/v1/availability', 'GET'), 'read');
});

test('compareProbeRouteKind matches POST bookings only', () => {
  assert.equal(compareProbeRouteKind('/v1/bookings', 'POST'), 'book');
  assert.equal(compareProbeRouteKind('/bookings', 'POST'), 'book');
  assert.equal(compareProbeRouteKind('/v1/bookings', 'GET'), null);
});
