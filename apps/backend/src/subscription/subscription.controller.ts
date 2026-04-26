import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';

@Controller('subscription')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private service: SubscriptionService) {}

  @Get('status')
  status(@Req() req: any) {
    return this.service.getStatus(req.user.userId);
  }

  @Post('buy')
  buy(@Req() req: any) {
    return this.service.buy(req.user.userId);
  }
}
