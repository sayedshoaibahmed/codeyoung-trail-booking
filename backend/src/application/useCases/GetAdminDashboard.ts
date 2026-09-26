/**
 * Application use case — GetAdminDashboard
 *
 * Returns a pre-aggregated read-model for the admin dashboard.
 *
 * Design notes:
 *   - Read-only: bypasses UnitOfWork and domain mutation rules.
 *   - Goes through AdminDashboardRepository port — the interface layer never
 *     touches Prisma directly.
 *   - TimezoneService.now() is used so the "upcoming" cutoff is testable.
 */
import type { AdminDashboardRepository, AdminDashboardData } from '../ports/AdminDashboardRepository';
import type { TimezoneService } from '../ports/TimezoneService';

export type { AdminDashboardData } from '../ports/AdminDashboardRepository';

export class GetAdminDashboardUseCase {
  constructor(
    private readonly dashboardRepo: AdminDashboardRepository,
    private readonly tzService:     TimezoneService,
  ) {}

  async execute(): Promise<AdminDashboardData> {
    const now = this.tzService.now();
    return this.dashboardRepo.getDashboardData(now);
  }
}
