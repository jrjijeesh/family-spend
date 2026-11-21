import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '../../db/db.module';
import { expenses, auditLogs } from '../../db/schema';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async create(householdId: string, userId: string, dto: CreateExpenseDto) {
    // 1. Idempotency check
    const [existing] = await this.db
      .select()
      .from(expenses)
      .where(eq(expenses.idempotencyKey, dto.idempotencyKey))
      .limit(1);

    if (existing) return this.toResponse(existing);

    const amountPaise = BigInt(Math.round(dto.amount * 100));

    // 2. Atomic transaction: insert expense + audit log
    const created = await this.db.transaction(async (tx) => {
      const [expense] = await tx
        .insert(expenses)
        .values({
          householdId,
          userId,
          amountPaise,
          category: dto.category,
          paymentMode: dto.paymentMode,
          merchant: dto.merchant,
          notes: dto.notes,
          spentAt: dto.spentAt, // Already YYYY-MM-DD
          idempotencyKey: dto.idempotencyKey,
        })
        .returning();

      await tx.insert(auditLogs).values({
        householdId,
        actorId: userId,
        action: 'CREATE_EXPENSE',
        entityId: expense.id,
        metadata: { amount: dto.amount, category: dto.category },
      });

      return expense;
    });

    return this.toResponse(created);
  }

  private toResponse(e: typeof expenses.$inferSelect) {
    return {
      ...e,
      amount: Number(e.amountPaise) / 100,
      amountPaise: undefined,
    };
  }
}
