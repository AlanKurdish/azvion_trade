import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Role } from '@prisma/client';
import { SlideshowService } from './slideshow.service';
import { CreateSlideshowDto } from './dto/create-slideshow.dto';
import { UpdateSlideshowDto } from './dto/update-slideshow.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const slideshowStorage = diskStorage({
  destination: join(__dirname, '..', '..', 'uploads', 'slideshow'),
  filename: (
    _req: any,
    file: { originalname: string },
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

@Controller('slideshow')
export class SlideshowController {
  constructor(private slideshowService: SlideshowService) {}

  /** Public — active slides for the mobile app */
  @Get()
  findActive() {
    return this.slideshowService.findActive();
  }

  /** Admin — all slides including inactive */
  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.slideshowService.findAll();
  }

  /** Upload image and return the URL */
  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: slideshowStorage,
      limits: { fileSize: MAX_SIZE },
      fileFilter: (
        _req: any,
        file: { mimetype: string },
        cb: (error: Error | null, accept: boolean) => void,
      ) => {
        if (!ALLOWED_TYPES.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(@UploadedFile() file: { filename: string }) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    return { imageUrl: `/uploads/slideshow/${file.filename}` };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateSlideshowDto) {
    return this.slideshowService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateSlideshowDto) {
    return this.slideshowService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.slideshowService.remove(id);
  }
}
