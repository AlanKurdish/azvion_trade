import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WsGateway } from '../websocket/websocket.gateway';
import { CreateDebitCardDto, UpdateDebitCardDto } from './dto';
export { CreateDebitCardDto, UpdateDebitCardDto } from './dto';

@Injectable()
export class DebitCardsService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WsGateway,
  ) {}

  // ── Admin CRUD on the card templates ──────────────────────────────
  async createCard(dto: CreateDebitCardDto) {
    return this.prisma.debitCard.create({ data: dto });
  }

  async findAllCards(includeInactive = false) {
    return this.prisma.debitCard.findMany({
      where: {
        isDeleted: false,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { price: 'asc' },
    });
  }

  async updateCard(id: string, dto: UpdateDebitCardDto) {
    const card = await this.prisma.debitCard.findUnique({ where: { id } });
    if (!card || card.isDeleted) throw new NotFoundException('Card not found');
    return this.prisma.debitCard.update({ where: { id }, data: dto });
  }

  async removeCard(id: string) {
    const card = await this.prisma.debitCard.findUnique({ where: { id } });
    if (!card || card.isDeleted) throw new NotFoundException('Card not found');
    await this.prisma.debitCard.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });
    return { message: 'Card deleted' };
  }

  // ── User: list all currently-active purchases for the logged-in user ──
  async findActiveForUser(userId: string) {
    const now = new Date();
    return this.prisma.userDebitCard.findMany({
      where: { userId, expiresAt: { gt: now } },
      include: { debitCard: true },
      orderBy: { expiresAt: 'asc' },
    });
  }

  // ── Admin: list every active purchase across all users ────────────
  async findAllActivePurchases() {
    const now = new Date();
    return this.prisma.userDebitCard.findMany({
      where: { expiresAt: { gt: now } },
      include: {
        debitCard: true,
        user: { select: { id: true, phone: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { expiresAt: 'asc' },
    });
  }

  /**
   * User buys a debit card.
   *  - Deduct `card.price` from the buyer's balance
   *  - Credit `card.price` to the (single) admin's balance with a transaction record
   *  - Snapshot bonusAmount = balance × percentage (locked for the duration)
   */
  async buyCard(userId: string, cardId: string) {
    const card = await this.prisma.debitCard.findUnique({ where: { id: cardId } });
    if (!card || card.isDeleted || !card.isActive) {
      throw new NotFoundException('Card not found');
    }

    const balance = await this.prisma.balance.findUnique({ where: { userId } });
    if (!balance) throw new BadRequestException('No balance record');
    if (Number(balance.amount) < Number(card.price)) {
      throw new BadRequestException(
        `Insufficient balance. Card costs $${Number(card.price).toFixed(2)}, you have $${Number(balance.amount).toFixed(2)}`,
      );
    }

    // Find an admin to credit (use the first admin found)
    const admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    const balanceBeforePurchase = Number(balance.amount);
    const bonusAmount = (balanceBeforePurchase * Number(card.percentage)) / 100;
    const expiresAt = new Date(Date.now() + card.durationHours * 60 * 60 * 1000);

    const purchase = await this.prisma.$transaction(async (tx) => {
      // Re-check balance inside transaction
      const cur = await tx.balance.findUnique({ where: { userId } });
      if (!cur || Number(cur.amount) < Number(card.price)) {
        throw new BadRequestException('Insufficient balance');
      }

      // Deduct price from buyer
      await tx.balance.update({
        where: { userId },
        data: { amount: { decrement: Number(card.price) } },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: 'DEBIT_CARD_PURCHASE',
          amount: new Prisma.Decimal(-Number(card.price)),
          note: `Bought ${card.nameEn} (${Number(card.percentage)}% / ${card.durationHours}h)`,
        },
      });

      // Credit price to admin if one exists
      if (admin) {
        await tx.balance.upsert({
          where: { userId: admin.id },
          create: { userId: admin.id, amount: new Prisma.Decimal(Number(card.price)) },
          update: { amount: { increment: Number(card.price) } },
        });
        await tx.transaction.create({
          data: {
            userId: admin.id,
            type: 'DEBIT_CARD_INCOME',
            amount: new Prisma.Decimal(Number(card.price)),
            note: `Card sold to user ${userId} — ${card.nameEn}`,
          },
        });
      }

      return tx.userDebitCard.create({
        data: {
          userId,
          debitCardId: cardId,
          pricePaid: card.price,
          percentage: card.percentage,
          bonusAmount: new Prisma.Decimal(bonusAmount),
          durationHours: card.durationHours,
          expiresAt,
        },
        include: { debitCard: true },
      });
    });

    // Push fresh balance to the user
    const updated = await this.prisma.balance.findUnique({ where: { userId } });
    this.wsGateway.emitToUser(userId, 'balance:updated', { balance: updated?.amount });

    return purchase;
  }
}
