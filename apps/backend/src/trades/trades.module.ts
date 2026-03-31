import { Module } from '@nestjs/common';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';
import { MetatraderModule } from '../metatrader/metatrader.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [MetatraderModule, WebsocketModule],
  controllers: [TradesController],
  providers: [TradesService],
  exports: [TradesService],
})
export class TradesModule {}
