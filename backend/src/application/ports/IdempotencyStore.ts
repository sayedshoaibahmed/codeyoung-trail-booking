/**
 * Port — IdempotencyStore
 *
 * Stores and retrieves the result of a booking creation request keyed by the
 * client-supplied Idempotency-Key header value. Prevents duplicate bookings on
 * retries and detects conflicting reuse of a key with a different payload.
 */

export interface IdempotencyRecord {
  key: string;
  /** SHA-256 hex digest of the canonical (sorted-keys) JSON request body */
  payloadHash: string;
  /** The original HTTP response body, serialised as JSON string */
  responseJson: string;
  /** The booking id this record is associated with */
  bookingId: string;
  createdAt: Date;
}

export interface IdempotencyStore {
  /**
   * Looks up an existing record by key.
   * Returns null if not found.
   */
  findByKey(key: string): Promise<IdempotencyRecord | null>;

  /**
   * Persists a new idempotency record.
   * Must be called inside the same transaction as the booking INSERT so that
   * the record only exists if the booking was successfully created.
   *
   * Throws a unique-constraint error if the key already exists (race condition
   * between two concurrent first-time requests — the caller must handle this).
   */
  create(record: Omit<IdempotencyRecord, 'createdAt'>, tx: unknown): Promise<IdempotencyRecord>;
}
