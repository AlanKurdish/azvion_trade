import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WsGateway } from '../websocket/websocket.gateway';

@Injectable()
export class SubscriptionService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WsGateway,
  ) {}

  /** Read the current admin-defined monthly subscription price from settings */
  async getPrice(): Promise<number> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: 'subscription_price' },
    });
    return Number(setting?.value ?? 0);
  }

  /** Returns the most recent still-active subscription for a user, or null */
  async getActive(userId: string) {
    const now = new Date();
    return this.prisma.subscription.findFirst({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'desc' },
    });
  }

  /** Convenience for the Flutter app: status + price + expiry */
  async getStatus(userId: string) {
    const [active, price] = await Promise.all([
      this.getActive(userId),
      this.getPrice(),
    ]);
    return {
      active: !!active,
      expiresAt: active?.expiresAt ?? null,
      price,
    };
  }

  /** User buys a 1-month subscription */
  async buy(userId: string) {
    const price = await this.getPrice();
    if (price <= 0) {
      throw new BadRequestException('Subscriptions are not available right now');
    }

    const balance = await this.prisma.balance.findUnique({ where: { userId } });
    if (!balance) throw new BadRequestException('No balance record');
    if (Number(balance.amount) < price) {
      throw new BadRequestException(
        `Insufficient balance. Subscription costs $${price.toFixed(2)}`,
      );
    }

    const admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    // Extend an existing active subscription, or start a new 30-day one.
    const existing = await this.getActive(userId);
    const startsFrom = existing ? new Date(existing.expiresAt) : new Date();
    const expiresAt = new Date(startsFrom.getTime() + 30 * 24 * 60 * 60 * 1000);

    const sub = await this.prisma.$transaction(async (tx) => {
      const cur = await tx.balance.findUnique({ where: { userId } });
      if (!cur || Number(cur.amount) < price) {
        throw new BadRequestException('Insufficient balance');
      }

      await tx.balance.update({
        where: { userId },
        data: { amount: { decrement: price } },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: 'SUBSCRIPTION_PURCHASE',
          amount: new Prisma.Decimal(-price),
          note: 'Monthly blog subscription',
        },
      });

      if (admin) {
        await tx.balance.upsert({
          where: { userId: admin.id },
          create: { userId: admin.id, amount: new Prisma.Decimal(price) },
          update: { amount: { increment: price } },
        });
        await tx.transaction.create({
          data: {
            userId: admin.id,
            type: 'SUBSCRIPTION_INCOME',
            amount: new Prisma.Decimal(price),
            note: `Subscription paid by user ${userId}`,
          },
        });
      }

      return tx.subscription.create({
        data: {
          userId,
          pricePaid: new Prisma.Decimal(price),
          startsAt: startsFrom,
          expiresAt,
        },
      });
    });

    const updated = await this.prisma.balance.findUnique({ where: { userId } });
    this.wsGateway.emitToUser(userId, 'balance:updated', { balance: updated?.amount });

    return sub;
  }
}
