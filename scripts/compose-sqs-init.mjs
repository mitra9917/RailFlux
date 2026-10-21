/**
 * One-shot Compose init: create side-effects queue + DLQ redrive on ElasticMQ.
 */
import {
  SIDE_EFFECTS_DLQ_NAME,
  SIDE_EFFECTS_QUEUE_NAME,
} from '@railflux/shared';
import {
  createSideEffectsSqsClient,
  ensureSideEffectsQueueWithRedrive,
} from '@railflux/baseline/services/outbox-sqs-publisher.js';

const endpoint = process.env.SQS_ENDPOINT ?? 'http://elasticmq:9324';
const client = createSideEffectsSqsClient({
  region: process.env.AWS_REGION ?? 'elasticmq-local',
  endpoint,
  queueUrl: `${endpoint}/000000000000/placeholder`,
});

const { queueUrl, dlqUrl } = await ensureSideEffectsQueueWithRedrive(client, {
  queueName: SIDE_EFFECTS_QUEUE_NAME,
  dlqName: SIDE_EFFECTS_DLQ_NAME,
});

console.log(JSON.stringify({ event: 'sqs_init_ok', queueUrl, dlqUrl }));
