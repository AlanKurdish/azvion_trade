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
import { BalanceService } from './balance.service';
import { DepositWithdrawDto } from './dto/balance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('balances')
@UseGuards(JwtAuthGuard)
export class BalanceController {
  constructor(private balanceService: BalanceService) {}

  @Get('me')
  getMyBalance(@CurrentUser('id') userId: string) {
    return this.balanceService.getBalance(userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getAllBalances() {
    return this.balanceService.getAllBalances();
  }

  @Post(':userId/deposit')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deposit(
    @Param('userId') userId: string,
    @Body() dto: DepositWithdrawDto,
  ) {
    return this.balanceService.deposit(userId, dto.amount, dto.note);
  }

  @Post(':userId/withdraw')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  withdraw(
    @Param('userId') userId: string,
    @Body() dto: DepositWithdrawDto,
  ) {
    return this.balanceService.withdraw(userId, dto.amount, dto.note);
  }

  @Get(':userId/transactions')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getTransactions(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.balanceService.getTransactions(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }
}
