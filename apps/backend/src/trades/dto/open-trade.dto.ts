import { IsString, IsNotEmpty } from 'class-validator';

export class OpenTradeDto {
  @IsString()
  @IsNotEmpty()
  symbolId: string;
}
