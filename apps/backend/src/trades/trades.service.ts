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

  /**
   * Safely evaluate a price formula. Variables: ask, bid.
   */
  private evaluateFormula(formula: string, bid: number, ask: number): number | null {
    try {
      const sanitized = formula.replace(/\s/g, '');
      if (!/^[0-9+\-*/().askbid]+$/i.test(sanitized)) return null;
      const expr = sanitized
        .replace(/ask/gi, String(ask))
        .replace(/bid/gi, String(bid));
      const result = new Function(`return (${expr})`)();
      if (typeof result !== 'number' || !isFinite(result)) return null;
      return result;
    } catch {
      return null;
    }
  }

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

    if (symbol.isReadOnly) {
      throw new BadRequestException('Symbol is read-only and cannot be traded');
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

    // Step 0: Get live price and compute formula result
    const livePrice = await this.mtService.getPrice(symbol.mtSymbol);
    const liveBid = livePrice.bid;
    const liveAsk = livePrice.ask;

    let formulaPrice: number;
    if (symbol.formula) {
      // Evaluate the formula with live bid/ask
      const result = this.evaluateFormula(symbol.formula, liveBid, liveAsk);
      if (result === null || result <= 0) {
        throw new BadRequestException('Failed to compute price from formula. Check symbol formula configuration.');
      }
      formulaPrice = result;
    } else {
      // No formula — use ask price
      formulaPrice = liveAsk;
    }

    const totalCost = formulaPrice + Number(symbol.commission);
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
      const msg = error instanceof Error ? error.message : 'Unknown error';
      // Make MT5 margin errors clearer
      if (msg.toLowerCase().includes('not enough money') || msg.toLowerCase().includes('no money')) {
        throw new BadRequestException(
          'MT5 account has insufficient margin to open this position. Contact admin to fund the MT5 account.',
        );
      }
      throw new BadRequestException(`Failed to open trade on MetaTrader: ${msg}`);
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

      // Create trade record
      // openPrice = MT5 market price; customerPrice = formula result (what was deducted)
      // openBid/openAsk = raw market prices at time of purchase
      const newTrade = await tx.trade.create({
        data: {
          userId,
          symbolId,
          type: 'BUY',
          lotSize: symbol.lotSize,
          openPrice: mtOpenPrice ?? liveAsk,
          openBid: liveBid,
          openAsk: liveAsk,
          customerPrice: formulaPrice,
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
            amount: new Prisma.Decimal(-formulaPrice),
            tradeId: newTrade.id,
            note: `Buy ${symbol.displayName} @ $${formulaPrice.toFixed(2)}`,
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
    console.log(`[TRADE] Emitting trade:opened to user:${userId}`);
    this.wsGateway.emitToUser(userId, 'trade:opened', trade);
    this.wsGateway.emitAdminTradeOpened(trade);

    // Also emit balance update so app refreshes balance
    const updatedBalance = await this.prisma.balance.findUnique({ where: { userId } });
    this.wsGateway.emitToUser(userId, 'balance:updated', { balance: updatedBalance?.amount });

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

    // Compute formula close price for user display
    let customerClosePrice: number | null = null;
    try {
      const livePriceAtClose = await this.mtService.getPrice(trade.symbol.mtSymbol);
      if (trade.symbol.formula) {
        customerClosePrice = this.evaluateFormula(trade.symbol.formula, livePriceAtClose.bid, livePriceAtClose.ask);
      } else {
        customerClosePrice = livePriceAtClose.ask;
      }
    } catch {
      // Fallback: no formula close price
    }

    const updatedTrade = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.trade.update({
        where: { id: tradeId },
        data: {
          status: 'CLOSED',
          closePrice,
          customerClosePrice,
          profitLoss,
          closedAt: new Date(),
        },
        include: {
          symbol: { select: { displayName: true, mtSymbol: true } },
        },
      });

      // Credit balance: the exact customer price deducted on open + MT5 profit/loss
      const deductedPrice = Number(trade.customerPrice);
      const creditAmount = deductedPrice + profitLoss;
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
          note: `Close ${trade.symbol.displayName} | Returned: $${deductedPrice} | P/L: ${profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)}`,
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

  async getTradeHistory(userId: string, page = 1, limit = 20, fromDate?: string, toDate?: string) {
    const skip = (page - 1) * limit;
    const where: any = { userId, status: 'CLOSED' };
    if (fromDate || toDate) {
      where.closedAt = {};
      if (fromDate) where.closedAt.gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        where.closedAt.lte = to;
      }
    }
    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where,
        include: {
          symbol: {
            select: { displayName: true, mtSymbol: true, name: true },
          },
        },
        skip,
        take: limit,
        orderBy: { closedAt: 'desc' },
      }),
      this.prisma.trade.count({ where }),
    ]);
    return { trades, total, page, limit };
  }

  async getDashboard(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      monthlyTrades,
      allClosedTrades,
      balance,
      openTradesCount,
      totalDeposits,
      totalWithdrawals,
      totalCommissions,
    ] = await Promise.all([
      // Monthly closed trades
      this.prisma.trade.findMany({
        where: { userId, status: 'CLOSED', closedAt: { gte: startOfMonth } },
        select: { profitLoss: true, commission: true },
      }),
      // All-time closed trades
      this.prisma.trade.findMany({
        where: { userId, status: 'CLOSED' },
        select: { profitLoss: true },
      }),
      // Balance
      this.prisma.balance.findUnique({ where: { userId } }),
      // Open trades count
      this.prisma.trade.count({ where: { userId, status: 'OPEN' } }),
      // Total deposits
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { userId, type: 'DEPOSIT' },
      }),
      // Total withdrawals
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { userId, type: 'WITHDRAWAL' },
      }),
      // Total commissions paid
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { userId, type: 'COMMISSION' },
      }),
    ]);

    const monthlyPnl = monthlyTrades.reduce((sum, t) => sum + Number(t.profitLoss ?? 0), 0);
    const monthlyCommission = monthlyTrades.reduce((sum, t) => sum + Number(t.commission), 0);
    const totalPnl = allClosedTrades.reduce((sum, t) => sum + Number(t.profitLoss ?? 0), 0);

    return {
      balance: balance ? Number(balance.amount) : 0,
      openTradesCount,
      closedTradesCount: allClosedTrades.length,
      monthlyPnl,
      monthlyCommission,
      // All-time stats
      totalDeposit: Number(totalDeposits._sum.amount || 0),
      totalWithdrawal: Math.abs(Number(totalWithdrawals._sum.amount || 0)),
      totalPnl,
      totalCommission: Math.abs(Number(totalCommissions._sum.amount || 0)),
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

    // Compute formula close price for user display
    let customerClosePrice: number | null = null;
    try {
      const livePriceAtClose = await this.mtService.getPrice(trade.symbol.mtSymbol);
      if (trade.symbol.formula) {
        customerClosePrice = this.evaluateFormula(trade.symbol.formula, livePriceAtClose.bid, livePriceAtClose.ask);
      } else {
        customerClosePrice = livePriceAtClose.ask;
      }
    } catch {
      // Fallback: no formula close price
    }

    const updatedTrade = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.trade.update({
        where: { id: tradeId },
        data: {
          status: 'CLOSED',
          closePrice,
          customerClosePrice,
          profitLoss,
          closedAt: new Date(),
        },
        include: {
          symbol: { select: { displayName: true, mtSymbol: true } },
        },
      });

      // Credit balance: the exact customer price deducted on open + MT5 profit/loss
      const deductedPrice = Number(trade.customerPrice);
      const creditAmount = deductedPrice + profitLoss;
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
          note: `Close ${trade.symbol.displayName} | Returned: $${deductedPrice} | P/L: ${profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)}`,
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
  async getAllTrades(
    page = 1,
    limit = 20,
    status?: string,
    userId?: string,
    fromDate?: string,
    toDate?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where,
        include: {
          user: { select: { phone: true, firstName: true, lastName: true } },
          symbol: { select: { displayName: true, name: true, mtSymbol: true } },
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

  async getAdminDashboardStats() {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      openTradesCount,
      closedTradesCount,
      totalRevenue,
      totalPnl,
      activeUsers,
      totalUsers,
      platformBalance,
      deposits,
      withdrawals,
      winCount,
      loseCount,
      recentTrades,
      allClosedTrades,
      allTrades,
      topSymbolsRaw,
    ] = await Promise.all([
      // Open trades
      this.prisma.trade.count({ where: { status: 'OPEN' } }),
      // Closed trades
      this.prisma.trade.count({ where: { status: 'CLOSED' } }),
      // Total revenue (commissions)
      this.prisma.trade.aggregate({
        _sum: { commission: true },
      }),
      // Total P&L
      this.prisma.trade.aggregate({
        _sum: { profitLoss: true },
        where: { status: 'CLOSED' },
      }),
      // Active users
      this.prisma.user.count({ where: { isActive: true, role: 'USER' } }),
      // Total users
      this.prisma.user.count({ where: { role: 'USER' } }),
      // Platform balance
      this.prisma.balance.aggregate({ _sum: { amount: true } }),
      // Total deposits
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'DEPOSIT' },
      }),
      // Total withdrawals
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'WITHDRAWAL' },
      }),
      // Win count
      this.prisma.trade.count({
        where: { status: 'CLOSED', profitLoss: { gt: 0 } },
      }),
      // Lose count
      this.prisma.trade.count({
        where: { status: 'CLOSED', profitLoss: { lte: 0 } },
      }),
      // Recent trades
      this.prisma.trade.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
          symbol: { select: { displayName: true } },
        },
      }),
      // All closed trades for monthly grouping
      this.prisma.trade.findMany({
        where: {
          status: 'CLOSED',
          createdAt: { gte: sixMonthsAgo },
        },
        select: { createdAt: true, commission: true, profitLoss: true },
      }),
      // All trades for monthly volume
      this.prisma.trade.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
      }),
      // Top symbols
      this.prisma.trade.groupBy({
        by: ['symbolId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    // Build monthly data for last 6 months
    const monthlyData: Array<{
      month: string;
      trades: number;
      revenue: number;
      pnl: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });

      const monthTrades = allTrades.filter((t) => {
        const td = new Date(t.createdAt);
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
      });

      const monthClosed = allClosedTrades.filter((t) => {
        const td = new Date(t.createdAt);
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
      });

      monthlyData.push({
        month: label,
        trades: monthTrades.length,
        revenue: monthClosed.reduce((s, t) => s + Number(t.commission || 0), 0),
        pnl: monthClosed.reduce((s, t) => s + Number(t.profitLoss || 0), 0),
      });
    }

    // Resolve top symbols names
    const symbolIds = topSymbolsRaw.map((s) => s.symbolId);
    const symbolNames = await this.prisma.symbol.findMany({
      where: { id: { in: symbolIds } },
      select: { id: true, displayName: true },
    });
    const nameMap = new Map(symbolNames.map((s) => [s.id, s.displayName]));

    const topSymbols = topSymbolsRaw.map((s) => ({
      name: nameMap.get(s.symbolId) || s.symbolId,
      trades: s._count.id,
    }));

    return {
      kpis: {
        totalRevenue: Number(totalRevenue._sum.commission || 0),
        totalPnl: Number(totalPnl._sum.profitLoss || 0),
        openTrades: openTradesCount,
        closedTrades: closedTradesCount,
        activeUsers,
        totalUsers,
        platformBalance: Number(platformBalance._sum.amount || 0),
        totalDeposits: Number(deposits._sum.amount || 0),
        totalWithdrawals: Math.abs(Number(withdrawals._sum.amount || 0)),
      },
      winRate: closedTradesCount > 0
        ? Math.round((winCount / closedTradesCount) * 100)
        : 0,
      monthlyData,
      topSymbols,
      recentTrades: recentTrades.map((t) => ({
        id: t.id,
        user: t.user?.firstName || t.user?.phone,
        symbol: t.symbol?.displayName,
        type: t.type,
        status: t.status,
        openPrice: Number(t.openPrice),
        profitLoss: t.profitLoss ? Number(t.profitLoss) : null,
        commission: Number(t.commission),
        date: t.createdAt,
      })),
    };
  }
}
