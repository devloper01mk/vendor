import { IsOptional, IsString, MaxLength } from "class-validator";

/** Maps spreadsheet column *titles* (first row) to logical fields. */
export class ImportColumnMapDto {
  @IsString()
  @MaxLength(120)
  itemName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsString()
  @MaxLength(120)
  siteName!: string;

  @IsString()
  @MaxLength(120)
  vendorName!: string;

  @IsString()
  @MaxLength(120)
  totalAmount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  billReceived?: string;

  @IsString()
  @MaxLength(120)
  entryDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  notes?: string;
}
