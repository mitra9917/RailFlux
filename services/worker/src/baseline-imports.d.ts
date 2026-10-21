declare module '@railflux/baseline/db.js' {
  import type mysql from 'mysql2/promise';

  export type DbPool = mysql.Pool;

  export function createPool(config: {
    nodeEnv: string;
    port: number;
    profile: 'baseline';
    syntheticJwtSecret: string;
    mysql: {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
    };
  }): DbPool;

  export function pingDatabase(pool: DbPool): Promise<boolean>;
}

declare module '@railflux/baseline/services/outbox-sqs-publisher.js' {
  import type { SQSClient } from '@aws-sdk/client-sqs';

  export type SideEffectsSqsConfig = {
    region: string;
    endpoint: string;
    queueUrl: string;
  };

  export function loadSideEffectsSqsConfig(
    env?: NodeJS.ProcessEnv,
  ): SideEffectsSqsConfig;
  export function createSideEffectsSqsClient(config: SideEffectsSqsConfig): SQSClient;
}

declare module '@railflux/baseline/services/booking-side-effect-worker.js' {
  import type { BookingConfirmedOutboxMessage } from '@railflux/shared';
  import type { DbPool } from '@railflux/baseline/db.js';

  export function parseBookingConfirmedQueueMessage(
    body: string,
  ): BookingConfirmedOutboxMessage | null;

  export function processBookingConfirmedSideEffectMessage(
    pool: DbPool,
    message: BookingConfirmedOutboxMessage,
    handlerType?: string,
  ): Promise<
    | { ok: true; processed: true; handlerType: string }
    | { ok: true; processed: false; handlerType: string; reason: 'ALREADY_PROCESSED' }
    | { ok: false; reason: 'INVALID_MESSAGE' | 'OUTBOX_NOT_FOUND' }
  >;
}
