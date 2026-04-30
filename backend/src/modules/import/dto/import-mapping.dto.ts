import { IsOptional, IsString, MaxLength } from "class-validator";

/** Maps spreadsheet column *titles* (first row) to logical fields. */
export class ImportColumnMapDto {
  @IsString()
  @MaxLength(120)
  entryDate!: string;

  @IsString()
  @MaxLength(120)
  itemName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  details?: string;

  @IsString()
  @MaxLength(120)
  brandPerson!: string;

  @IsString()
  @MaxLength(120)
  siteName!: string;

  @IsString()
  @MaxLength(120)
  totalAmount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paidTotal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  billStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  notes?: string;
}
