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

  @Type(() => Number)
  @IsNumber()
  price: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  commission?: number;

  @IsBoolean()
  @IsOptional()
  isTradable?: boolean;
}
