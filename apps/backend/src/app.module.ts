import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SymbolsModule } from './symbols/symbols.module';
import { TradesModule } from './trades/trades.module';
import { BalanceModule } from './balance/balance.module';
import { MetatraderModule } from './metatrader/metatrader.module';
import { WebsocketModule } from './websocket/websocket.module';
import { SettingsModule } from './settings/settings.module';
import { SlideshowModule } from './slideshow/slideshow.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60000, limit: 60 },
      { name: 'long', ttl: 600000, limit: 200 },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    SymbolsModule,
    TradesModule,
    BalanceModule,
    MetatraderModule,
    WebsocketModule,
    SettingsModule,
    SlideshowModule,
  ],
})
export class AppModule {}
