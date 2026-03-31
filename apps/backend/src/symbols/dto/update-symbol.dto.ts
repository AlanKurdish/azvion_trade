import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSymbolDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  lotSize?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  amount?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  price?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  commission?: number;

  @IsBoolean()
  @IsOptional()
  isTradable?: boolean;
}
