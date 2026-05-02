import { Module } from '@nestjs/common';
import { LegalController } from './legal.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LegalController],
})
export class LegalModule {}
