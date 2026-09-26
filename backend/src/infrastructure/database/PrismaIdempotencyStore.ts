/**
 * Infrastructure — PrismaIdempotencyStore
 *
 * Concrete implementation of the IdempotencyStore port.
 * Injected at the composition root; never imported by application or domain layers.
 */
import type { PrismaClient } from '@prisma/client';
import type { IdempotencyStore, IdempotencyRecord } from '../../application/ports';

export class PrismaIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db: PrismaClient) {}

  async findByKey(key: string): Promise<IdempotencyRecord | null> {
    const record = await this.db.idempotencyKey.findUnique({ where: { key } });
    if (!record) return null;
    return {
      key: record.key,
      payloadHash: record.payloadHash,
      responseJson: record.responseJson,
      bookingId: record.bookingId,
      createdAt: record.createdAt,
    };
  }

  async create(
    record: Omit<IdempotencyRecord, 'createdAt'>,
    tx: unknown,
  ): Promise<IdempotencyRecord> {
    const client = tx as PrismaClient;
    const created = await client.idempotencyKey.create({
      data: {
        key: record.key,
        payloadHash: record.payloadHash,
        responseJson: record.responseJson,
        bookingId: record.bookingId,
      },
    });
    return {
      key: created.key,
      payloadHash: created.payloadHash,
      responseJson: created.responseJson,
      bookingId: created.bookingId,
      createdAt: created.createdAt,
    };
  }
}
