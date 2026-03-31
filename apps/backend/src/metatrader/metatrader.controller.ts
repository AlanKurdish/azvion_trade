import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MetatraderService } from './metatrader.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { IsString, IsNotEmpty } from 'class-validator';

class ConnectDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsString()
  @IsNotEmpty()
  token: string;
}

@Controller('mt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class MetatraderController {
  constructor(private mtService: MetatraderService) {}

  @Post('connect')
  connect(@Body() dto: ConnectDto) {
    return this.mtService.connect(dto.accountId, dto.token);
  }

  @Get('status')
  getStatus() {
    return this.mtService.getConnectionStatus();
  }

  @Post('disconnect')
  disconnect() {
    return this.mtService.disconnect();
  }

  @Get('symbols')
  getSymbols() {
    return this.mtService.loadSymbols();
  }

  @Get('positions')
  getPositions() {
    return this.mtService.getPositions();
  }
}
