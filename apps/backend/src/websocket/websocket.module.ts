import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WsGateway } from './websocket.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [WsGateway],
  exports: [WsGateway],
})
export class WebsocketModule {}
