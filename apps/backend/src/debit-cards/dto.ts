import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDebitCardDto {
  @IsString() @IsNotEmpty() nameEn!: string;
  @IsString() @IsNotEmpty() nameAr!: string;
  @IsString() @IsNotEmpty() nameCkb!: string;

  @Type(() => Number) @IsNumber() @Min(0) percentage!: number;
  @Type(() => Number) @IsNumber() @Min(0) price!: number;
  @Type(() => Number) @IsInt() @Min(1) durationHours!: number;

  @IsBoolean() @IsOptional() isActive?: boolean;
}

export class UpdateDebitCardDto {
  @IsString() @IsOptional() nameEn?: string;
  @IsString() @IsOptional() nameAr?: string;
  @IsString() @IsOptional() nameCkb?: string;

  @Type(() => Number) @IsNumber() @IsOptional() @Min(0) percentage?: number;
  @Type(() => Number) @IsNumber() @IsOptional() @Min(0) price?: number;
  @Type(() => Number) @IsInt() @IsOptional() @Min(1) durationHours?: number;

  @IsBoolean() @IsOptional() isActive?: boolean;
}
