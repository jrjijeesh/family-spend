import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { and, desc, eq, gte, isNull, lt, ne, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '../../db/db.module';
import { expenses } from '../../db/schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getMonthlySummary(householdId: string, month: string) {
    const cacheKey = `analytics:v2:${householdId}:${month}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const startDate = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const nextMonthDate = new Date(year, mon, 1).toISOString().slice(0, 10);
    const sixMonthsAgo = new Date(year, mon - 6, 1).toISOString().slice(0, 10);

    const baseFilter = and(
      eq(expenses.householdId, householdId),
      isNull(expenses.deletedAt),
      gte(expenses.spentAt, startDate),
      lt(expenses.spentAt, nextMonthDate),
    );

    const [
      byCategory,
      byPaymentMode,
      dailyTrendRaw,
      topMerchants,
      weekdaySplit,
      sixMonthTrend,
      [totals],
    ] = await Promise.all([
      // 1. Category breakdown
      this.db
        .select({
          label: expenses.category,
          paise: sql<string>`COALESCE(SUM(${expenses.amountPaise}), 0)`,
        })
        .from(expenses)
        .where(baseFilter)
        .groupBy(expenses.category)
        .orderBy(desc(sql`SUM(${expenses.amountPaise})`)),

      // 2. Payment mode split
      this.db
        .select({
          label: expenses.paymentMode,
          paise: sql<string>`COALESCE(SUM(${expenses.amountPaise}), 0)`,
        })
        .from(expenses)
        .where(baseFilter)
        .groupBy(expenses.paymentMode)
        .orderBy(desc(sql`SUM(${expenses.amountPaise})`)),

      // 3. Daily trend (used for Bar Chart, Cumulative Line & Heatmap)
      this.db
        .select({
          day: sql<string>`TO_CHAR(${expenses.spentAt}, 'DD')`,
          paise: sql<string>`COALESCE(SUM(${expenses.amountPaise}), 0)`,
        })
        .from(expenses)
        .where(baseFilter)
        .groupBy(expenses.spentAt)
        .orderBy(expenses.spentAt),

      // 4. Top 5 merchants
      this.db
        .select({
          label: expenses.merchant,
          paise: sql<string>`COALESCE(SUM(${expenses.amountPaise}), 0)`,
          visits: sql<number>`COUNT(*)::int`,
        })
        .from(expenses)
        .where(
          and(
            baseFilter,
            sql`${expenses.merchant} IS NOT NULL`,
            ne(expenses.merchant, ''),
          ),
        )
        .groupBy(expenses.merchant)
        .orderBy(desc(sql`SUM(${expenses.amountPaise})`))
        .limit(5),

      // 5. Weekday (Mon-Fri) vs Weekend (Sat-Sun) average daily spend
      this.db
        .select({
          dayType: sql<string>`CASE WHEN EXTRACT(ISODOW FROM ${expenses.spentAt}) >= 6 THEN 'Weekend' ELSE 'Weekday' END`,
          paise: sql<string>`COALESCE(SUM(${expenses.amountPaise}), 0)`,
          activeDays: sql<number>`COUNT(DISTINCT ${expenses.spentAt})::int`,
        })
        .from(expenses)
        .where(baseFilter)
        .groupBy(
          sql`CASE WHEN EXTRACT(ISODOW FROM ${expenses.spentAt}) >= 6 THEN 'Weekend' ELSE 'Weekday' END`,
        ),

      // 6. 6-month historical trend
      this.db
        .select({
          month: sql<string>`TO_CHAR(${expenses.spentAt}, 'YYYY-MM')`,
          paise: sql<string>`COALESCE(SUM(${expenses.amountPaise}), 0)`,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.householdId, householdId),
            isNull(expenses.deletedAt),
            gte(expenses.spentAt, sixMonthsAgo),
            lt(expenses.spentAt, nextMonthDate),
          ),
        )
        .groupBy(sql`TO_CHAR(${expenses.spentAt}, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${expenses.spentAt}, 'YYYY-MM')`),

      // 7. Totals
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

    const dailyTrend = dailyTrendRaw.map((r) => ({
      day: r.day,
      value: Number(r.paise) / 100,
    }));

    // Build cumulative burn-rate curve
    let running = 0;
    const cumulativeTrend = dailyTrend.map((d) => {
      running += d.value;
      return { day: d.day, value: Math.round(running) };
    });

    const result = {
      month,
      daysInMonth,
      totalSpend,
      transactionCount: totals?.count ?? 0,
      dailyAverage: Math.round(totalSpend / elapsedDays),
      projectedMonthEnd: Math.round((totalSpend / elapsedDays) * daysInMonth),
      byCategory: byCategory.map((r) => ({
        label: r.label,
        value: Number(r.paise) / 100,
      })),
      byPaymentMode: byPaymentMode.map((r) => ({
        label: r.label,
        value: Number(r.paise) / 100,
      })),
      dailyTrend,
      cumulativeTrend,
      topMerchants: topMerchants.map((r) => ({
        label: r.label || 'Unknown',
        value: Number(r.paise) / 100,
        visits: r.visits,
      })),
      weekdayVsWeekend: weekdaySplit.map((r) => ({
        label: r.dayType,
        total: Number(r.paise) / 100,
        avgPerDay:
          r.activeDays > 0
            ? Math.round(Number(r.paise) / 100 / r.activeDays)
            : 0,
      })),
      sixMonthTrend: sixMonthTrend.map((r) => ({
        label: r.month.slice(5), // MM
        month: r.month,
        value: Math.round(Number(r.paise) / 100),
      })),
    };

    await this.cache.set(cacheKey, result, 60_000); // 1 min cache
    return result;
  }
}
