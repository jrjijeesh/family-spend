import { Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getMonthlySummary(householdId: string, month: string) {
    const cacheKey = `analytics:${householdId}:${month}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const startDate = new Date(`${month}-01`);
    const endDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      1,
    );

    const [byCategory, dailyTrend, totals] = await Promise.all([
      this.prisma.$queryRaw<Array<{ label: string; paise: bigint }>>`
        SELECT category AS label, SUM(amount_paise) AS paise
        FROM "Expense"
        WHERE household_id = ${householdId}
          AND deleted_at IS NULL
          AND spent_at >= ${startDate} AND spent_at < ${endDate}
        GROUP BY category
        ORDER BY paise DESC
      `,
      this.prisma.$queryRaw<Array<{ day: string; paise: bigint }>>`
        SELECT TO_CHAR(spent_at, 'DD') AS day, SUM(amount_paise) AS paise
        FROM "Expense"
        WHERE household_id = ${householdId}
          AND deleted_at IS NULL
          AND spent_at >= ${startDate} AND spent_at < ${endDate}
        GROUP BY spent_at
        ORDER BY spent_at ASC
      `,
      this.prisma.expense.aggregate({
        where: {
          householdId,
          deletedAt: null,
          spentAt: { gte: startDate, lt: endDate },
        },
        _sum: { amountPaise: true },
        _count: true,
      }),
    ]);

    const totalSpend = Number(totals._sum.amountPaise ?? 0n) / 100;
    const daysInMonth = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      0,
    ).getDate();
    const today = new Date();
    const elapsedDays =
      today.toISOString().slice(0, 7) === month
        ? Math.max(today.getDate(), 1)
        : daysInMonth;

    const result = {
      month,
      totalSpend,
      transactionCount: totals._count,
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

    await this.cache.set(cacheKey, result, 300_000); // 5 min TTL
    return result;
  }
}
