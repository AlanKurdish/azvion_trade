import { Module } from '@nestjs/common';
import { SlideshowController } from './slideshow.controller';
import { SlideshowService } from './slideshow.service';

@Module({
  controllers: [SlideshowController],
  providers: [SlideshowService],
  exports: [SlideshowService],
})
export class SlideshowModule {}
