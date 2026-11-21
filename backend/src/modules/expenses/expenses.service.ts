import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(householdId: string, userId: string, dto: CreateExpenseDto) {
    // 1. Idempotency check: safe against mobile retries / double-taps
    const existing = await this.prisma.expense.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return this.toResponse(existing);

    const amountPaise = BigInt(Math.round(dto.amount * 100));

    // 2. Atomic transaction: insert expense + write audit log
    const created = await this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          householdId,
          userId,
          amountPaise,
          category: dto.category,
          paymentMode: dto.paymentMode,
          merchant: dto.merchant,
          notes: dto.notes,
          spentAt: new Date(dto.spentAt),
          idempotencyKey: dto.idempotencyKey,
        },
      });

      await tx.auditLog.create({
        data: {
          householdId,
          actorId: userId,
          action: "CREATE_EXPENSE",
          entityId: expense.id,
          metadata: { amount: dto.amount, category: dto.category },
        },
      });

      return expense;
    });

    return this.toResponse(created);
  }

  private toResponse(e: any) {
    return {
      ...e,
      amount: Number(e.amountPaise) / 100,
      amountPaise: undefined,
    };
  }
}
