import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateSiteDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;
}
