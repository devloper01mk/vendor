import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { RequirementStatus } from "@prisma/client";

export class CreateRequirementDto {
  @IsString()
  @MaxLength(500)
  itemName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  brand?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  totalAmount!: number;

  @IsOptional()
  @IsEnum(RequirementStatus)
  status?: RequirementStatus;

  @IsOptional()
  @IsBoolean()
  billReceived?: boolean;

  @IsDateString()
  entryDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsUUID()
  vendorId!: string;

  @IsUUID()
  siteId!: string;
}
