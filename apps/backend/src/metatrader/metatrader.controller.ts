import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MetatraderService } from './metatrader.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('mt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class MetatraderController {
  constructor(private mtService: MetatraderService) {}

  @Post('connect')
  connect(@Body() body: { login: string; password: string; server: string }) {
    return this.mtService.connect(body.login, body.password, body.server);
  }

  @Post('auto-connect')
  autoConnect() {
    return this.mtService.autoConnect();
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
