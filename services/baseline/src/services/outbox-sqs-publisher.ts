import {
  BOOKING_CONFIRMED_EVENT_TYPE,
  type BookingConfirmedOutboxMessage,
} from '@railflux/shared';
import {
  CreateQueueCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import type { RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db.js';

export type SideEffectsSqsConfig = {
  region: string;
  endpoint: string;
  queueUrl: string;
};

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function loadSideEffectsSqsConfig(
  env: NodeJS.ProcessEnv = process.env,
): SideEffectsSqsConfig {
  return {
    region: env.AWS_REGION ?? 'elasticmq-local',
    endpoint: required('SQS_ENDPOINT', env.SQS_ENDPOINT),
    queueUrl: required('SQS_SIDE_EFFECTS_QUEUE_URL', env.SQS_SIDE_EFFECTS_QUEUE_URL),
  };
}

export function createSideEffectsSqsClient(config: SideEffectsSqsConfig): SQSClient {
  return new SQSClient({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: envLocalAccessKey(),
      secretAccessKey: envLocalSecretKey(),
    },
  });
}

function envLocalAccessKey(): string {
  return process.env.AWS_ACCESS_KEY_ID ?? 'local';
}

function envLocalSecretKey(): string {
  return process.env.AWS_SECRET_ACCESS_KEY ?? 'local';
}

interface OutboxPublishRow extends RowDataPacket {
  eventType: string;
  payload: BookingConfirmedOutboxMessage;
  publishedAt: Date | null;
}

/** After booking commit: send durable outbox payload to SQS and mark `published_at`. */
export async function publishBookingConfirmedOutboxToSqs(
  pool: DbPool,
  input: { eventId: string },
  sqsClient: SQSClient,
  queueUrl: string,
): Promise<{ ok: true; published: boolean }> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<OutboxPublishRow[]>(
      `SELECT event_type AS eventType,
              payload,
              published_at AS publishedAt
       FROM outbox_events
       WHERE event_id = ?
       FOR UPDATE`,
      [input.eventId],
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return { ok: true, published: false };
    }
    if (row.eventType !== BOOKING_CONFIRMED_EVENT_TYPE) {
      throw new Error(`Outbox event ${input.eventId} is not BOOKING_CONFIRMED`);
    }
    if (row.publishedAt !== null) {
      await conn.commit();
      return { ok: true, published: false };
    }

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(row.payload),
      }),
    );

    await conn.query(
      `UPDATE outbox_events SET published_at = CURRENT_TIMESTAMP(6) WHERE event_id = ?`,
      [input.eventId],
    );
    await conn.commit();
    return { ok: true, published: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Integration/CI queue name (separate from local dev `railflux-side-effects` worker). */
export const INTEGRATION_SIDE_EFFECTS_QUEUE_NAME = 'railflux-side-effects-integration';

/** Remove visible messages so tests are not affected by a running dev worker on the default queue. */
export async function purgeSideEffectsQueue(
  sqsClient: SQSClient,
  queueUrl: string,
): Promise<void> {
  await sqsClient.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));
}

/** Test/CI helper: ensure queue exists on ElasticMQ. */
export async function ensureSideEffectsQueue(
  sqsClient: SQSClient,
  queueName: string,
): Promise<string> {
  const created = await sqsClient.send(
    new CreateQueueCommand({
      QueueName: queueName,
    }),
  );
  if (created.QueueUrl) {
    return created.QueueUrl;
  }
  throw new Error(`CreateQueue did not return QueueUrl for ${queueName}`);
}

export async function receiveSideEffectsMessage(
  sqsClient: SQSClient,
  queueUrl: string,
): Promise<BookingConfirmedOutboxMessage | null> {
  const res = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 2,
    }),
  );
  const body = res.Messages?.[0]?.Body;
  if (!body) return null;
  return JSON.parse(body) as BookingConfirmedOutboxMessage;
}
