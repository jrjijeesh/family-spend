import {
  pgTable,
  pgEnum,
  uuid,
  text,
  bigint,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['ADMIN', 'MEMBER', 'VIEWER']);

export const households = pgTable('households', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  currency: text('currency').default('INR').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .references(() => households.id)
      .notNull(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').default('MEMBER').notNull(),
    refreshToken: text('refresh_token'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('users_household_idx').on(table.householdId)],
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .references(() => households.id)
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    amountPaise: bigint('amount_paise', { mode: 'bigint' }).notNull(),
    category: text('category').notNull(),
    paymentMode: text('payment_mode').notNull(),
    merchant: text('merchant'),
    notes: text('notes'),
    spentAt: date('spent_at').notNull(), // YYYY-MM-DD
    idempotencyKey: text('idempotency_key').notNull().unique(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('expenses_household_spent_idx').on(table.householdId, table.spentAt),
    index('expenses_household_cat_idx').on(table.householdId, table.category),
  ],
);

export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .references(() => households.id)
      .notNull(),
    category: text('category').notNull(),
    month: text('month').notNull(), // YYYY-MM
    limitPaise: bigint('limit_paise', { mode: 'bigint' }).notNull(),
  },
  (table) => [
    uniqueIndex('budgets_household_cat_month_idx').on(
      table.householdId,
      table.category,
      table.month,
    ),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    action: text('action').notNull(),
    entityId: uuid('entity_id').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_household_created_idx').on(table.householdId, table.createdAt),
  ],
);
