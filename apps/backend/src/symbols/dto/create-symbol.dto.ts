import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSymbolDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsNotEmpty()
  mtSymbol: string;

  @Type(() => Number)
  @IsNumber()
  lotSize: number;

  @Type(() => Number)
  @IsNumber()
  amount: number;

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
