import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetatraderService } from '../metatrader/metatrader.service';
import { WsGateway } from '../websocket/websocket.gateway';

@Injectable()
export class TradesService {
  constructor(
    private prisma: PrismaService,
    private mtService: MetatraderService,
    private wsGateway: WsGateway,
  ) {}

  async openTrade(userId: string, symbolId: string) {
    const [symbol, user] = await Promise.all([
      this.prisma.symbol.findUnique({ where: { id: symbolId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, phone: true },
      }),
    ]);

    if (!symbol || !symbol.isTradable) {
      throw new BadRequestException('Symbol is not available for trading');
    }

    // Build comment: use name if ASCII, otherwise phone
    const fullName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : '';
    // eslint-disable-next-line no-control-regex
    const isAscii = /^[\x00-\x7F]*$/.test(fullName);
    const userName = isAscii && fullName ? fullName : user?.phone || 'User';

    const balance = await this.prisma.balance.findUnique({
      where: { userId },
    });

    if (!balance) {
      throw new BadRequestException('No balance record found');
    }

    const totalCost = Number(symbol.price) + Number(symbol.commission);
    if (Number(balance.amount) < totalCost) {
      throw new BadRequestException(
        `Insufficient balance. Required: $${totalCost.toFixed(2)}, Available: $${Number(balance.amount).toFixed(2)}`,
      );
    }

    // Step 1: Open on MetaTrader FIRST (outside DB transaction to avoid timeout)
    let mtOrderId: string | null = null;
    let mtOpenPrice: number | null = null;
    try {
      const mtResult = await this.mtService.openPosition(
        symbol.mtSymbol,
        Number(symbol.lotSize),
        'buy',
        userName,
      );
      // Use positionId (MT5 position ticket) for tracking, not deal orderId
      mtOrderId = mtResult.positionId || mtResult.orderId;
      mtOpenPrice = mtResult.openPrice || null;
    } catch (error) {
      throw new BadRequestException(
        `Failed to open trade on MetaTrader: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Step 2: Record everything in DB transaction
    const trade = await this.prisma.$transaction(async (tx) => {
      // Re-check balance inside transaction (race condition guard)
      const currentBalance = await tx.balance.findUnique({
        where: { userId },
      });
      if (!currentBalance || Number(currentBalance.amount) < totalCost) {
        throw new BadRequestException('Insufficient balance');
      }

      // Deduct balance
      await tx.balance.update({
        where: { userId },
        data: { amount: { decrement: totalCost } },
      });

      // Create trade record (use MT5 open price if available, else admin-set price)
      const newTrade = await tx.trade.create({
        data: {
          userId,
          symbolId,
          type: 'BUY',
          lotSize: symbol.lotSize,
          openPrice: mtOpenPrice ?? symbol.price,
          commission: symbol.commission,
          mtOrderId,
        },
        include: {
          symbol: { select: { displayName: true, mtSymbol: true } },
        },
      });

      // Record transactions with tradeId link
      await tx.transaction.createMany({
        data: [
          {
            userId,
            type: 'TRADE_OPEN',
            amount: new Prisma.Decimal(-Number(symbol.price)),
            tradeId: newTrade.id,
            note: `Buy ${symbol.displayName}`,
          },
          ...(Number(symbol.commission) > 0
            ? [
                {
                  userId,
                  type: 'COMMISSION' as const,
                  amount: new Prisma.Decimal(-Number(symbol.commission)),
                  tradeId: newTrade.id,
                  note: `Commission for ${symbol.displayName}`,
                },
              ]
            : []),
        ],
      });

      return newTrade;
    });

    // Step 3: Notify via WebSocket
    this.wsGateway.emitToUser(userId, 'trade:opened', trade);
    this.wsGateway.emitAdminTradeOpened(trade);

    return trade;
  }

  async closeTrade(userId: string, tradeId: string) {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: { symbol: true },
    });

    if (!trade) throw new NotFoundException('Trade not found');
    if (trade.userId !== userId)
      throw new ForbiddenException('Not your trade');
    if (trade.status !== 'OPEN')
      throw new BadRequestException('Trade is not open');

    // Close on MetaTrader — get real close price and profit from MT5
    let closePrice: number;
    let mtProfit: number;
    try {
      const mtResult = await this.mtService.closePosition(
        trade.mtOrderId ?? '',
      );
      closePrice = mtResult.closePrice;
      mtProfit = mtResult.profit;
    } catch (error) {
      throw new BadRequestException(
        `Failed to close trade on MetaTrader: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Use MT5's actual profit (includes contract size, currency conversion, swap)
    const profitLoss = mtProfit;

    const updatedTrade = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.trade.update({
        where: { id: tradeId },
        data: {
          status: 'CLOSED',
          closePrice,
          profitLoss,
          closedAt: new Date(),
        },
        include: {
          symbol: { select: { displayName: true, mtSymbol: true } },
        },
      });

      // Credit balance: original trade price + MT5 actual profit
      const creditAmount = Number(trade.openPrice) + profitLoss;
      await tx.balance.update({
        where: { userId },
        data: { amount: { increment: creditAmount } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'TRADE_CLOSE',
          amount: new Prisma.Decimal(creditAmount),
          tradeId,
          note: `Close ${trade.symbol.displayName} P/L: ${profitLoss.toFixed(2)}`,
        },
      });

      return closed;
    });

    // Notify via WebSocket
    const closePayload = { ...updatedTrade, realizedPnl: profitLoss };
    this.wsGateway.emitToUser(userId, 'trade:closed', closePayload);
    this.wsGateway.emitAdminTradeClosed(closePayload);

    const balance = await this.prisma.balance.findUnique({
      where: { userId },
    });
    this.wsGateway.emitToUser(userId, 'balance:updated', {
      balance: balance?.amount,
    });

    return updatedTrade;
  }

  async getOpenTrades(userId: string) {
    return this.prisma.trade.findMany({
      where: { userId, status: 'OPEN' },
      include: {
        symbol: { select: { displayName: true, mtSymbol: true, name: true } },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async getTradeHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where: { userId, status: 'CLOSED' },
        include: {
          symbol: {
            select: { displayName: true, mtSymbol: true, name: true },
          },
        },
        skip,
        take: limit,
        orderBy: { closedAt: 'desc' },
      }),
      this.prisma.trade.count({ where: { userId, status: 'CLOSED' } }),
    ]);
    return { trades, total, page, limit };
  }

  async getDashboard(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const trades = await this.prisma.trade.findMany({
      where: {
        userId,
        status: 'CLOSED',
        closedAt: { gte: startOfMonth },
      },
      select: { profitLoss: true, commission: true },
    });

    const totalPnl = trades.reduce(
      (sum, t) => sum + Number(t.profitLoss ?? 0),
      0,
    );
    const totalCommission = trades.reduce(
      (sum, t) => sum + Number(t.commission),
      0,
    );

    const balance = await this.prisma.balance.findUnique({
      where: { userId },
    });

    const openTradesCount = await this.prisma.trade.count({
      where: { userId, status: 'OPEN' },
    });

    return {
      monthlyPnl: totalPnl,
      monthlyCommission: totalCommission,
      closedTradesCount: trades.length,
      openTradesCount,
      balance: balance ? Number(balance.amount) : 0,
    };
  }

  // Admin: open trade on behalf of a user
  async adminOpenTrade(userId: string, symbolId: string) {
    return this.openTrade(userId, symbolId);
  }

  // Admin: close trade on behalf of a user (bypasses ownership check)
  async adminCloseTrade(tradeId: string) {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: { symbol: true },
    });

    if (!trade) throw new NotFoundException('Trade not found');
    if (trade.status !== 'OPEN')
      throw new BadRequestException('Trade is not open');

    // Close on MetaTrader — get real close price and profit
    let closePrice: number;
    let mtProfit: number;
    try {
      const mtResult = await this.mtService.closePosition(
        trade.mtOrderId ?? '',
      );
      closePrice = mtResult.closePrice;
      mtProfit = mtResult.profit;
    } catch (error) {
      throw new BadRequestException(
        `Failed to close trade on MetaTrader: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Use MT5's actual profit
    const profitLoss = mtProfit;

    const updatedTrade = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.trade.update({
        where: { id: tradeId },
        data: {
          status: 'CLOSED',
          closePrice,
          profitLoss,
          closedAt: new Date(),
        },
        include: {
          symbol: { select: { displayName: true, mtSymbol: true } },
        },
      });

      const creditAmount = Number(trade.openPrice) + profitLoss;
      await tx.balance.update({
        where: { userId: trade.userId },
        data: { amount: { increment: creditAmount } },
      });

      await tx.transaction.create({
        data: {
          userId: trade.userId,
          type: 'TRADE_CLOSE',
          amount: new Prisma.Decimal(creditAmount),
          tradeId,
          note: `Close ${trade.symbol.displayName} P/L: ${profitLoss.toFixed(2)}`,
        },
      });

      return closed;
    });

    // Notify user via WebSocket
    const closePayload2 = { ...updatedTrade, realizedPnl: profitLoss };
    this.wsGateway.emitToUser(trade.userId, 'trade:closed', closePayload2);
    this.wsGateway.emitAdminTradeClosed(closePayload2);

    const balance = await this.prisma.balance.findUnique({
      where: { userId: trade.userId },
    });
    this.wsGateway.emitToUser(trade.userId, 'balance:updated', {
      balance: balance?.amount,
    });

    return updatedTrade;
  }

  // Admin methods
  async getAllTrades(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};

    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where,
        include: {
          user: { select: { phone: true, firstName: true, lastName: true } },
          symbol: { select: { displayName: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.trade.count({ where }),
    ]);

    return { trades, total, page, limit };
  }

  async getUserTrades(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where: { userId },
        include: {
          symbol: { select: { displayName: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.trade.count({ where: { userId } }),
    ]);

    return { trades, total, page, limit };
  }
}
