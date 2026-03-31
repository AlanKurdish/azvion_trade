import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSymbolDto } from './dto/create-symbol.dto';
import { UpdateSymbolDto } from './dto/update-symbol.dto';

@Injectable()
export class SymbolsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSymbolDto) {
    return this.prisma.symbol.create({ data: dto });
  }

  async findAllTradable() {
    return this.prisma.symbol.findMany({
      where: { isTradable: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.symbol.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const symbol = await this.prisma.symbol.findUnique({ where: { id } });
    if (!symbol) throw new NotFoundException('Symbol not found');
    return symbol;
  }

  async update(id: string, dto: UpdateSymbolDto) {
    await this.findOne(id);
    return this.prisma.symbol.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.symbol.delete({ where: { id } });
    return { message: 'Symbol deleted' };
  }
}
