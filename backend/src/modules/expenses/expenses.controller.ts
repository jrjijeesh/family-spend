import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@ApiTags('Expenses')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Log a daily expense (idempotent)' })
  @ApiHeader({
    name: 'x-household-id',
    required: false,
    description: 'Temporary household UUID until JWT is wired',
  })
  @ApiHeader({
    name: 'x-user-id',
    required: false,
    description: 'Temporary user UUID until JWT is wired',
  })
  create(
    @Body() dto: CreateExpenseDto,
    @Headers('x-household-id')
    householdId = '00000000-0000-0000-0000-000000000001',
    @Headers('x-user-id') userId = '00000000-0000-0000-0000-000000000002',
  ) {
    return this.expensesService.create(householdId, userId, dto);
  }
}
