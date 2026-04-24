import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class ToggleHighlightDto {
  @IsBoolean()
  flagged!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
