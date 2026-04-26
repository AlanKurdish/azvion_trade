import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto';
export { CreateBlogPostDto, UpdateBlogPostDto } from './dto';

@Injectable()
export class BlogService {
  constructor(
    private prisma: PrismaService,
    private subscription: SubscriptionService,
  ) {}

  // ── Admin CRUD ────────────────────────────────────────────────
  create(dto: CreateBlogPostDto) {
    return this.prisma.blogPost.create({ data: dto });
  }

  findAllAdmin() {
    return this.prisma.blogPost.findMany({
      where: { isDeleted: false },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateBlogPostDto) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) throw new NotFoundException('Post not found');
    return this.prisma.blogPost.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) throw new NotFoundException('Post not found');
    await this.prisma.blogPost.update({
      where: { id },
      data: { isDeleted: true, isPublished: false },
    });
    return { message: 'Post deleted' };
  }

  // ── User-facing list — requires active subscription ───────────
  async listForUser(userId: string) {
    const active = await this.subscription.getActive(userId);
    if (!active) {
      throw new ForbiddenException('Active subscription required');
    }
    return this.prisma.blogPost.findMany({
      where: { isDeleted: false, isPublished: true },
      orderBy: { publishedAt: 'desc' },
    });
  }
}
