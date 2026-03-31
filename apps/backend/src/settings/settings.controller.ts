import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { IsString, IsNotEmpty } from 'class-validator';

class UpdateSettingDto {
  @IsString()
  @IsNotEmpty()
  value: string;
}

@Controller('settings')
export class SettingsController {
  constructor(private prisma: PrismaService) {}

  @Get('privacy-policy')
  async getPrivacyPolicy() {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: 'privacy_policy' },
    });
    return { value: setting?.value ?? '' };
  }

  @Put(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.prisma.appSetting.upsert({
      where: { key },
      update: { value: dto.value },
      create: { key, value: dto.value },
    });
  }
}
