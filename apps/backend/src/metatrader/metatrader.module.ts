import { Module } from '@nestjs/common';
import { MetatraderController } from './metatrader.controller';
import { MetatraderService } from './metatrader.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  controllers: [MetatraderController],
  providers: [MetatraderService],
  exports: [MetatraderService],
})
export class MetatraderModule {}
