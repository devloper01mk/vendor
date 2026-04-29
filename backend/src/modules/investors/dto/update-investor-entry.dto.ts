import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateInvestorEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  paymentReceivedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
