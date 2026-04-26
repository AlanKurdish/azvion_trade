import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BalanceService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string) {
    const balance = await this.prisma.balance.findUnique({
      where: { userId },
    });
    if (!balance) throw new NotFoundException('Balance not found');

    // Add the snapshotted bonus from any currently-active debit cards.
    const now = new Date();
    const activeCards = await this.prisma.userDebitCard.findMany({
      where: { userId, expiresAt: { gt: now } },
      select: { bonusAmount: true },
    });
    const bonusTotal = activeCards.reduce(
      (sum, c) => sum + Number(c.bonusAmount),
      0,
    );

    return {
      ...balance,
      // Live balance the Flutter app should display
      effectiveAmount: Number(balance.amount) + bonusTotal,
      bonusAmount: bonusTotal,
      activeCardsCount: activeCards.length,
    };
  }

  async getAllBalances() {
    return this.prisma.balance.findMany({
      include: {
        user: {
          select: { phone: true, firstName: true, lastName: true, isActive: true },
        },
      },
    });
  }

  async deposit(userId: string, amount: number, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.balance.update({
        where: { userId },
        data: { amount: { increment: amount } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          amount,
          note: note ?? 'Deposit',
        },
      });

      return balance;
    });
  }

  async withdraw(userId: string, amount: number, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.balance.findUnique({ where: { userId } });
      if (!current || Number(current.amount) < amount) {
        throw new NotFoundException('Insufficient balance');
      }

      const balance = await tx.balance.update({
        where: { userId },
        data: { amount: { decrement: amount } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'WITHDRAWAL',
          amount: -amount,
          note: note ?? 'Withdrawal',
        },
      });

      return balance;
    });
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({ where: { userId } }),
    ]);
    return { transactions, total, page, limit };
  }
}
