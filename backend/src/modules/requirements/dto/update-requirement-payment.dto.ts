import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateRequirementPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
