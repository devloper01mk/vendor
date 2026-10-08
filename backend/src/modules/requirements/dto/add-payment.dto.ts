import { Type } from "class-transformer";
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class AddPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @IsIn(["yes", "no"])
  billStatus?: "yes" | "no";
}
