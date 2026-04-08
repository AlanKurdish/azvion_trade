import { Module } from '@nestjs/common';
import { SymbolsController } from './symbols.controller';
import { SymbolsService } from './symbols.service';
import { MetatraderModule } from '../metatrader/metatrader.module';

@Module({
  imports: [MetatraderModule],
  controllers: [SymbolsController],
  providers: [SymbolsService],
  exports: [SymbolsService],
})
export class SymbolsModule {}
