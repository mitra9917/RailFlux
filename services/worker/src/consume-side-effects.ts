import { DeleteMessageCommand, ReceiveMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import type { DbPool } from '@railflux/baseline/db.js';
import {
  parseBookingConfirmedQueueMessage,
  processBookingConfirmedSideEffectMessage,
} from '@railflux/baseline/services/booking-side-effect-worker.js';

export type SideEffectPollResult = {
  received: number;
  processed: number;
  duplicates: number;
  invalid: number;
  notFound: number;
  /** Handler threw; message left on queue for retry / DLQ redrive. */
  failed: number;
};

/** Poll once and process up to one message (at-least-once safe via processed_events). */
export async function pollSideEffectsQueueOnce(
  pool: DbPool,
  sqsClient: SQSClient,
  queueUrl: string,
  waitSeconds: number,
): Promise<SideEffectPollResult> {
  const result: SideEffectPollResult = {
    received: 0,
    processed: 0,
    duplicates: 0,
    invalid: 0,
    notFound: 0,
    failed: 0,
  };

  const res = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: waitSeconds,
    }),
  );

  const message = res.Messages?.[0];
  if (!message?.Body || !message.ReceiptHandle) {
    return result;
  }

  result.received = 1;
  const parsed = parseBookingConfirmedQueueMessage(message.Body);
  if (!parsed) {
    result.invalid = 1;
    return result;
  }

  let outcome;
  try {
    outcome = await processBookingConfirmedSideEffectMessage(pool, parsed);
  } catch {
    result.failed = 1;
    return result;
  }
  if (!outcome.ok) {
    if (outcome.reason === 'OUTBOX_NOT_FOUND') {
      result.notFound = 1;
    } else {
      result.invalid = 1;
    }
    return result;
  }

  if (outcome.processed) {
    result.processed = 1;
  } else {
    result.duplicates = 1;
  }

  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    }),
  );

  return result;
}
