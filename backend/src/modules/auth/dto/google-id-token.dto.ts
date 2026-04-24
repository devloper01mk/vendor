import { IsString, MinLength } from "class-validator";

export class GoogleIdTokenDto {
  @IsString()
  @MinLength(20)
  idToken!: string;
}
