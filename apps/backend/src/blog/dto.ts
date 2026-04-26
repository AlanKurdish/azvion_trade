import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBlogPostDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() content!: string;
  @IsString() @IsOptional() imageUrl?: string;
  @IsBoolean() @IsOptional() isPublished?: boolean;
}

export class UpdateBlogPostDto {
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() content?: string;
  @IsString() @IsOptional() imageUrl?: string;
  @IsBoolean() @IsOptional() isPublished?: boolean;
}
