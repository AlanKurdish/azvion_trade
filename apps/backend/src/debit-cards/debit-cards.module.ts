import { Module } from '@nestjs/common';
import { DebitCardsController } from './debit-cards.controller';
import { DebitCardsService } from './debit-cards.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [PrismaModule, WebsocketModule],
  controllers: [DebitCardsController],
  providers: [DebitCardsService],
  exports: [DebitCardsService],
})
export class DebitCardsModule {}
