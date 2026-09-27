/**
 * entities/booking — public barrel
 *
 * FSD rule: entities must only re-export from within their own slice.
 */
export type { Booking } from './model/types';
export { bookingApi } from './api';
export { BookingDetailCard } from './ui/BookingDetailCard';
