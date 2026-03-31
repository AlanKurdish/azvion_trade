import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { SymbolsService } from './symbols.service';
import { CreateSymbolDto } from './dto/create-symbol.dto';
import { UpdateSymbolDto } from './dto/update-symbol.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('symbols')
@UseGuards(JwtAuthGuard)
export class SymbolsController {
  constructor(private symbolsService: SymbolsService) {}

  @Get()
  findTradable() {
    return this.symbolsService.findAllTradable();
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.symbolsService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateSymbolDto) {
    return this.symbolsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateSymbolDto) {
    return this.symbolsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.symbolsService.remove(id);
  }
}
