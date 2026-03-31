import { IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class DepositWithdrawDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsOptional()
  note?: string;
}
