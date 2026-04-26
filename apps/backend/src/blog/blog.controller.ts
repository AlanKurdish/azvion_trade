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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Role } from '@prisma/client';
import {
  BlogService,
  CreateBlogPostDto,
  UpdateBlogPostDto,
} from './blog.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const blogStorage = diskStorage({
  destination: join(__dirname, '..', '..', 'uploads', 'blog'),
  filename: (
    _req: any,
    file: { originalname: string },
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

@Controller('blog')
export class BlogController {
  constructor(private service: BlogService) {}

  // User: list posts (requires subscription)
  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Req() req: any) {
    return this.service.listForUser(req.user.id);
  }

  // Admin: list every post
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminList() {
    return this.service.findAllAdmin();
  }

  /** Upload an image to /uploads/blog and return its URL — used both for
   * the post hero image and for inline images in the rich-text editor. */
  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: blogStorage,
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
    return { imageUrl: `/uploads/blog/${file.filename}` };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateBlogPostDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
