import { Module } from '@nestjs/common';
import { SymbolsController } from './symbols.controller';
import { SymbolsService } from './symbols.service';

@Module({
  controllers: [SymbolsController],
  providers: [SymbolsService],
  exports: [SymbolsService],
})
export class SymbolsModule {}
