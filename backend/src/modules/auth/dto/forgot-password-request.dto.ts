import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class ForgotPasswordRequestDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

