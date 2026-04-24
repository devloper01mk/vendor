import { IsBoolean } from "class-validator";

export class SetBlockedDto {
  @IsBoolean()
  blocked!: boolean;
}

