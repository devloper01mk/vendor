import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateInvestorEntryDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  date!: string;

  @IsDateString()
  paymentReceivedDate!: string;

  @IsString()
  @MaxLength(100)
  paymentMode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
