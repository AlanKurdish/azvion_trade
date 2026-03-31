import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  language?: string;
}

export class AdminUpdateUserDto extends UpdateUserDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
