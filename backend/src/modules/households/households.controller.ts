import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { HouseholdsService } from './households.service';

class CreateHouseholdDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

@ApiTags('Households')
@Controller('households')
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get()
  @ApiOperation({ summary: 'List all families' })
  listAll() {
    return this.householdsService.listAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new isolated family' })
  create(@Body() dto: CreateHouseholdDto) {
    return this.householdsService.create(dto.name);
  }
}
