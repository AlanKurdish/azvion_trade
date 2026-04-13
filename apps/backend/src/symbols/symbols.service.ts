import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetatraderService } from '../metatrader/metatrader.service';
import { CreateSymbolDto } from './dto/create-symbol.dto';
import { UpdateSymbolDto } from './dto/update-symbol.dto';

@Injectable()
export class SymbolsService {
  constructor(
    private prisma: PrismaService,
    private mtService: MetatraderService,
  ) {}

  async create(dto: CreateSymbolDto) {
    const symbol = await this.prisma.symbol.create({ data: dto });
    // Re-subscribe so new symbol gets price streaming + refresh formula cache
    await this.mtService.subscribeToTradableSymbols();
    await this.mtService.refreshFormulaCache();
    return symbol;
  }

  async findAllTradable() {
    return this.prisma.symbol.findMany({
      where: { isTradable: true, isDeleted: false },
      orderBy: { name: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.symbol.findMany({
      where: { isDeleted: false },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const symbol = await this.prisma.symbol.findUnique({ where: { id } });
    if (!symbol) throw new NotFoundException('Symbol not found');
    return symbol;
  }

  async update(id: string, dto: UpdateSymbolDto) {
    await this.findOne(id);
    const symbol = await this.prisma.symbol.update({ where: { id }, data: dto });
    // Re-subscribe in case isTradable changed + refresh formula cache
    await this.mtService.subscribeToTradableSymbols();
    await this.mtService.refreshFormulaCache();
    return symbol;
  }

  async remove(id: string) {
    await this.findOne(id);

    // Block if there are OPEN trades linked
    const openTradeCount = await this.prisma.trade.count({
      where: { symbolId: id, status: 'OPEN' },
    });
    if (openTradeCount > 0) {
      throw new BadRequestException(
        `Cannot delete symbol: ${openTradeCount} open trade(s) are linked to it. Close them first.`,
      );
    }

    // Soft delete — hide from trading but keep for trade history
    await this.prisma.symbol.update({
      where: { id },
      data: { isTradable: false, isDeleted: true },
    });
    return { message: 'Symbol deleted' };
  }
}
