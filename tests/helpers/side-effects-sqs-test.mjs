import {
  createSideEffectsSqsClient,
  ensureSideEffectsQueue,
  INTEGRATION_SIDE_EFFECTS_QUEUE_NAME,
  purgeSideEffectsQueue,
} from '@railflux/baseline/services/outbox-sqs-publisher.js';

export { INTEGRATION_SIDE_EFFECTS_QUEUE_NAME };

export function sideEffectsSqsEndpoint() {
  return process.env.SQS_ENDPOINT ?? 'http://127.0.0.1:9324';
}

export function createIntegrationSideEffectsSqsClient() {
  return createSideEffectsSqsClient({
    region: process.env.AWS_REGION ?? 'elasticmq-local',
    endpoint: sideEffectsSqsEndpoint(),
    queueUrl: 'http://placeholder',
  });
}

/** Dedicated integration queue; sets `SQS_SIDE_EFFECTS_QUEUE_URL` for booking publish. */
export async function prepareIntegrationSideEffectsQueue(sqsClient, options = {}) {
  const purge = options.purge ?? true;
  const queueUrl = await ensureSideEffectsQueue(
    sqsClient,
    INTEGRATION_SIDE_EFFECTS_QUEUE_NAME,
  );
  if (purge) {
    await purgeSideEffectsQueue(sqsClient, queueUrl);
  }
  process.env.SQS_SIDE_EFFECTS_QUEUE_URL = queueUrl;
  return queueUrl;
}
