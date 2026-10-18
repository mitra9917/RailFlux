import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RailFluxError, signSyntheticJwt, verifySyntheticJwt } from '@railflux/shared';

const SECRET = 'test-secret-for-unit-tests';
const USER_ID = '11111111-1111-4111-8111-111111111111';

test('verifySyntheticJwt accepts a valid signed token', async () => {
  const token = await signSyntheticJwt(SECRET, { userId: USER_ID, cohort: 'quick' });
  const auth = await verifySyntheticJwt(token, SECRET);
  assert.equal(auth.userId, USER_ID);
  assert.equal(auth.cohort, 'quick');
});

test('verifySyntheticJwt rejects missing and malformed tokens', async () => {
  await assert.rejects(async () => verifySyntheticJwt('', SECRET), (err) => {
    return err instanceof RailFluxError && err.httpStatus === 401;
  });
  await assert.rejects(async () => verifySyntheticJwt('not-a-jwt', SECRET), (err) => {
    return err instanceof RailFluxError && err.httpStatus === 401;
  });
});

test('verifySyntheticJwt rejects wrong secret', async () => {
  const token = await signSyntheticJwt(SECRET, { userId: USER_ID });
  await assert.rejects(async () => verifySyntheticJwt(token, 'other-secret'), (err) => {
    return err instanceof RailFluxError && err.httpStatus === 401;
  });
});
