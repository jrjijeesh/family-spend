import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HouseholdsModule } from './modules/households/households.module';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    DbModule,
    HouseholdsModule,
    ExpensesModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
