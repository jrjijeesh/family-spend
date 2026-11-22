import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '../../db/db.module';
import { households, users } from '../../db/schema';

@Injectable()
export class HouseholdsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async listAll() {
    const rows = await this.db
      .select({
        householdId: households.id,
        name: households.name,
        userId: users.id,
      })
      .from(households)
      .innerJoin(users, eq(users.householdId, households.id));

    // Return one entry per household
    const unique = new Map<
      string,
      { householdId: string; name: string; userId: string }
    >();
    for (const r of rows) {
      if (!unique.has(r.householdId)) unique.set(r.householdId, r);
    }
    return Array.from(unique.values());
  }

  async create(name: string) {
    return this.db.transaction(async (tx) => {
      const [household] = await tx
        .insert(households)
        .values({ name: name.trim() })
        .returning();

      const [user] = await tx
        .insert(users)
        .values({
          householdId: household.id,
          name: `${name.trim()} Admin`,
          email: `admin-${household.id.slice(0, 8)}@family.local`,
          passwordHash: 'temp',
          role: 'ADMIN',
        })
        .returning();

      return {
        householdId: household.id,
        name: household.name,
        userId: user.id,
      };
    });
  }
}
