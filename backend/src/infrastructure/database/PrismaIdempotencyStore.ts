/**
 * Infrastructure — PrismaIdempotencyStore
 *
 * Implements IdempotencyStore. Constructor receives the appropriate Prisma client.
 */
import type { PrismaClient } from '@prisma/client';
import type { IdempotencyStore, IdempotencyRecord, CreateIdempotencyData } from '../../application/ports';

export class PrismaIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db: PrismaClient) {}

  async findByKey(key: string): Promise<IdempotencyRecord | null> {
    const record = await this.db.idempotencyKey.findUnique({ where: { key } });
    if (!record) return null;
    return {
      key:          record.key,
      payloadHash:  record.payloadHash,
      responseJson: record.responseJson,
      bookingId:    record.bookingId,
      createdAt:    record.createdAt,
    };
  }

  async create(data: CreateIdempotencyData): Promise<IdempotencyRecord> {
    const record = await this.db.idempotencyKey.create({
      data: {
        key:          data.key,
        payloadHash:  data.payloadHash,
        responseJson: data.responseJson,
        bookingId:    data.bookingId,
      },
    });
    return {
      key:          record.key,
      payloadHash:  record.payloadHash,
      responseJson: record.responseJson,
      bookingId:    record.bookingId,
      createdAt:    record.createdAt,
    };
  }
}
