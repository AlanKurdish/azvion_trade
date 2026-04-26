import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  CreateDebitCardDto,
  DebitCardsService,
  UpdateDebitCardDto,
} from './debit-cards.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('debit-cards')
export class DebitCardsController {
  constructor(private service: DebitCardsService) {}

  // ── Public list of cards (used by Flutter) ──────────────────────
  @Get()
  @UseGuards(JwtAuthGuard)
  list() {
    return this.service.findAllCards(false);
  }

  // ── Active purchases for the logged-in user ─────────────────────
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@Req() req: any) {
    return this.service.findActiveForUser(req.user.userId);
  }

  // ── Buy a card ──────────────────────────────────────────────────
  @Post(':id/buy')
  @UseGuards(JwtAuthGuard)
  buy(@Param('id') id: string, @Req() req: any) {
    return this.service.buyCard(req.user.userId, id);
  }

  // ── Admin: list all cards including inactive ────────────────────
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminListAll() {
    return this.service.findAllCards(true);
  }

  // ── Admin: list ALL active purchases across all users ───────────
  @Get('admin/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminActivePurchases() {
    return this.service.findAllActivePurchases();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateDebitCardDto) {
    return this.service.createCard(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateDebitCardDto) {
    return this.service.updateCard(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.removeCard(id);
  }
}
