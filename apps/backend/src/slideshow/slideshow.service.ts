import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlideshowDto } from './dto/create-slideshow.dto';
import { UpdateSlideshowDto } from './dto/update-slideshow.dto';
import { join } from 'path';
import { unlink } from 'fs/promises';

@Injectable()
export class SlideshowService {
  private readonly logger = new Logger(SlideshowService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSlideshowDto) {
    return this.prisma.slideshow.create({ data: dto });
  }

  /** Public: active slides only, ordered */
  async findActive() {
    return this.prisma.slideshow.findMany({
      where: { isActive: true, isDeleted: false },
      orderBy: { order: 'asc' },
    });
  }

  /** Admin: all slides including inactive */
  async findAll() {
    return this.prisma.slideshow.findMany({
      where: { isDeleted: false },
      orderBy: { order: 'asc' },
    });
  }

  async update(id: string, dto: UpdateSlideshowDto) {
    const slide = await this.prisma.slideshow.findUnique({ where: { id } });
    if (!slide || slide.isDeleted) {
      throw new NotFoundException('Slide not found');
    }

    // If imageUrl changed, delete the old file
    if (dto.imageUrl && dto.imageUrl !== slide.imageUrl) {
      this.deleteImageFile(slide.imageUrl);
    }

    return this.prisma.slideshow.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const slide = await this.prisma.slideshow.findUnique({ where: { id } });
    if (!slide || slide.isDeleted) {
      throw new NotFoundException('Slide not found');
    }

    // Delete the image file
    this.deleteImageFile(slide.imageUrl);

    return this.prisma.slideshow.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });
  }

  /** Delete an uploaded image file from disk */
  private async deleteImageFile(imageUrl: string) {
    if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
    try {
      const filePath = join(__dirname, '..', '..', imageUrl);
      await unlink(filePath);
      this.logger.log(`Deleted image: ${imageUrl}`);
    } catch {
      // File may not exist, ignore
    }
  }
}
