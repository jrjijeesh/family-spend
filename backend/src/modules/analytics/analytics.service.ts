import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '../../db/db.module';
import { expenses } from '../../db/schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getMonthlySummary(householdId: string, month: string) {
    const cacheKey = `analytics:${householdId}:${month}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const startDate = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const nextMonthDate = new Date(year, mon, 1).toISOString().slice(0, 10);

    const baseFilter = and(
      eq(expenses.householdId, householdId),
      isNull(expenses.deletedAt),
      gte(expenses.spentAt, startDate),
      lt(expenses.spentAt, nextMonthDate),
    );

    const [byCategory, dailyTrend, [totals]] = await Promise.all([
      this.db
        .select({
          label: expenses.category,
          paise: sql<string>`COALESCE(SUM(${expenses.amountPaise}), 0)`,
        })
        .from(expenses)
        .where(baseFilter)
        .groupBy(expenses.category)
        .orderBy(desc(sql`SUM(${expenses.amountPaise})`)),

      this.db
        .select({
          day: sql<string>`TO_CHAR(${expenses.spentAt}, 'DD')`,
          paise: sql<string>`COALESCE(SUM(${expenses.amountPaise}), 0)`,
        })
        .from(expenses)
        .where(baseFilter)
        .groupBy(expenses.spentAt)
        .orderBy(expenses.spentAt),

      this.db
        .select({
          totalPaise: sql<string>`COALESCE(SUM(${expenses.amountPaise}), 0)`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(expenses)
        .where(baseFilter),
    ]);

    const totalSpend = Number(totals?.totalPaise ?? 0) / 100;
    const daysInMonth = new Date(year, mon, 0).getDate();
    const today = new Date();
    const elapsedDays =
      today.toISOString().slice(0, 7) === month
        ? Math.max(today.getDate(), 1)
        : daysInMonth;

    const result = {
      month,
      totalSpend,
      transactionCount: totals?.count ?? 0,
      dailyAverage: Math.round(totalSpend / elapsedDays),
      projectedMonthEnd: Math.round((totalSpend / elapsedDays) * daysInMonth),
      byCategory: byCategory.map((r) => ({
        label: r.label,
        value: Number(r.paise) / 100,
      })),
      dailyTrend: dailyTrend.map((r) => ({
        day: r.day,
        value: Number(r.paise) / 100,
      })),
    };

    await this.cache.set(cacheKey, result, 300_000);
    return result;
  }
}
