export type OutboxDeliveryMode = 'sync' | 'sqs';

export function getOutboxDeliveryMode(env: NodeJS.ProcessEnv = process.env): OutboxDeliveryMode {
  const raw = env.OUTBOX_DELIVERY ?? 'sync';
  if (raw === 'sync' || raw === 'sqs') {
    return raw;
  }
  throw new Error(`OUTBOX_DELIVERY must be "sync" or "sqs" (got ${raw})`);
}
