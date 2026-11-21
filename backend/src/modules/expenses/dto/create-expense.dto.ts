import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 450.5, description: 'Amount in INR' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'Groceries' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'UPI' })
  @IsString()
  @IsNotEmpty()
  paymentMode: string;

  @ApiPropertyOptional({ example: 'DMart' })
  @IsOptional()
  @IsString()
  merchant?: string;

  @ApiPropertyOptional({ example: 'Weekly vegetables and milk' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: '2026-11-21', description: 'YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'spentAt must be in YYYY-MM-DD format',
  })
  spentAt: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  idempotencyKey: string;
}
