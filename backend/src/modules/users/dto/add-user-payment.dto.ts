import { IsDateString, IsOptional } from "class-validator";
import { AddPaymentDto } from "../../requirements/dto/add-payment.dto";

export class AddUserPaymentDto extends AddPaymentDto {
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
