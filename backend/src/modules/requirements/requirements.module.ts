import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RequirementsController } from "./requirements.controller";
import { RequirementsService } from "./requirements.service";

@Module({
  imports: [AuthModule],
  controllers: [RequirementsController],
  providers: [RequirementsService],
  exports: [RequirementsService],
})
export class RequirementsModule {}
