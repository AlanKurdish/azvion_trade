import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    return this.prisma.symbolCategory.create({ data: dto });
  }

  /** Public: active categories with their tradable symbols (for mobile app) */
  async findActiveWithSymbols() {
    return this.prisma.symbolCategory.findMany({
      where: { isActive: true, isDeleted: false },
      orderBy: { order: 'asc' },
      include: {
        symbols: {
          where: { isDeleted: false },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  /** Admin: all categories (includes inactive, excludes deleted) */
  async findAll() {
    return this.prisma.symbolCategory.findMany({
      where: { isDeleted: false },
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { symbols: { where: { isDeleted: false } } } },
      },
    });
  }

  async findOne(id: string) {
    const cat = await this.prisma.symbolCategory.findUnique({ where: { id } });
    if (!cat || cat.isDeleted) throw new NotFoundException('Category not found');
    return cat;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    return this.prisma.symbolCategory.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Unlink symbols from this category (set categoryId to null) then soft-delete
    await this.prisma.symbol.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });
    await this.prisma.symbolCategory.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });
    return { message: 'Category deleted' };
  }
}
