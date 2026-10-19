import assert from 'node:assert/strict';
import { test } from 'node:test';
import { operationFromPath } from '../services/baseline/dist/logging/http-operation.js';

test('read service exposes search and availability operations only at v1', () => {
  assert.equal(operationFromPath('/v1/search'), 'search');
  assert.equal(operationFromPath('/v1/availability'), 'availability');
  assert.equal(operationFromPath('/v1/bookings'), 'booking');
});
