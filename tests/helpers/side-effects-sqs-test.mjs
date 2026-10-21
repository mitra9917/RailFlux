import {
  createSideEffectsSqsClient,
  ensureSideEffectsQueueWithRedrive,
  INTEGRATION_SIDE_EFFECTS_DLQ_NAME,
  INTEGRATION_SIDE_EFFECTS_QUEUE_NAME,
  purgeSideEffectsQueue,
} from '@railflux/baseline/services/outbox-sqs-publisher.js';

export { INTEGRATION_SIDE_EFFECTS_DLQ_NAME, INTEGRATION_SIDE_EFFECTS_QUEUE_NAME };

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
  const maxReceiveCount = options.maxReceiveCount;
  const visibilityTimeoutSeconds = options.visibilityTimeoutSeconds;
  const { queueUrl, dlqUrl } = await ensureSideEffectsQueueWithRedrive(sqsClient, {
    queueName: INTEGRATION_SIDE_EFFECTS_QUEUE_NAME,
    dlqName: INTEGRATION_SIDE_EFFECTS_DLQ_NAME,
    ...(maxReceiveCount !== undefined ? { maxReceiveCount } : {}),
    ...(visibilityTimeoutSeconds !== undefined ? { visibilityTimeoutSeconds } : {}),
  });
  if (purge) {
    await purgeSideEffectsQueue(sqsClient, queueUrl);
    await purgeSideEffectsQueue(sqsClient, dlqUrl);
  }
  process.env.SQS_SIDE_EFFECTS_QUEUE_URL = queueUrl;
  process.env.SQS_SIDE_EFFECTS_DLQ_URL = dlqUrl;
  return queueUrl;
}
