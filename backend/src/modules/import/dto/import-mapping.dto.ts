import { IsOptional, IsString, MaxLength } from "class-validator";

/** Maps spreadsheet column *titles* (first row) to logical fields. */
export class ImportColumnMapDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  requirementId?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendorPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendorAlternatePhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendorEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendorGstNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendorAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  siteCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  siteAddress?: string;

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
