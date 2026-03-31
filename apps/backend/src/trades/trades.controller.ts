import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { TradesService } from './trades.service';
import { OpenTradeDto } from './dto/open-trade.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('trades')
@UseGuards(JwtAuthGuard)
export class TradesController {
  constructor(private tradesService: TradesService) {}

  @Post('open')
  openTrade(
    @CurrentUser('id') userId: string,
    @Body() dto: OpenTradeDto,
  ) {
    return this.tradesService.openTrade(userId, dto.symbolId);
  }

  @Post(':id/close')
  closeTrade(
    @CurrentUser('id') userId: string,
    @Param('id') tradeId: string,
  ) {
    return this.tradesService.closeTrade(userId, tradeId);
  }

  @Get('open')
  getOpenTrades(@CurrentUser('id') userId: string) {
    return this.tradesService.getOpenTrades(userId);
  }

  @Get('history')
  getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tradesService.getTradeHistory(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('dashboard')
  getDashboard(@CurrentUser('id') userId: string) {
    return this.tradesService.getDashboard(userId);
  }

  @Post('admin/open')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminOpenTrade(
    @Body() body: { userId: string; symbolId: string },
  ) {
    return this.tradesService.adminOpenTrade(body.userId, body.symbolId);
  }

  @Post('admin/:id/close')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminCloseTrade(@Param('id') tradeId: string) {
    return this.tradesService.adminCloseTrade(tradeId);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getAllTrades(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.tradesService.getAllTrades(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
    );
  }

  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getUserTrades(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tradesService.getUserTrades(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }
}
