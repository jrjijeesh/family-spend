import { Controller, Get, Headers, Query } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get monthly spend summary & chart data' })
  @ApiQuery({ name: 'month', example: '2026-11', required: false })
  @ApiHeader({ name: 'x-household-id', required: false })
  getSummary(
    @Query('month') month = new Date().toISOString().slice(0, 7),
    @Headers('x-household-id')
    householdId = '00000000-0000-0000-0000-000000000001',
  ) {
    return this.analyticsService.getMonthlySummary(householdId, month);
  }
}
