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
  name?: string;

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

  @IsString()
  @IsOptional()
  amountLabel?: string;

  @IsString()
  @IsOptional()
  formula?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  commission?: number;

  @IsBoolean()
  @IsOptional()
  isTradable?: boolean;

  @IsBoolean()
  @IsOptional()
  isReadOnly?: boolean;

  @IsString()
  @IsOptional()
  categoryId?: string | null;
}
