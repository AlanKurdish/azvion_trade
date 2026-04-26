import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

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
  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsIn(['ADMIN', 'USER', 'SHOP'])
  @IsOptional()
  role?: 'ADMIN' | 'USER' | 'SHOP';
}
