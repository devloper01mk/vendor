import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { FileInterceptor } from "@nestjs/platform-express";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { memoryStorage } from "multer";
import { CurrentUser, type RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ImportColumnMapDto } from "./dto/import-mapping.dto";
import { ImportService } from "./import.service";

@Controller("import")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportController {
  constructor(private readonly importer: ImportService) {}

  @Post("spreadsheet")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body("columns") columnsRaw: string,
  ) {
    if (!file) throw new BadRequestException("file is required");
    let parsed: unknown;
    try {
      parsed = JSON.parse(columnsRaw ?? "{}");
    } catch {
      throw new BadRequestException("columns must be valid JSON");
    }
    const columns = plainToInstance(ImportColumnMapDto, parsed);
    const errors = validateSync(columns);
    if (errors.length) {
      throw new BadRequestException("Invalid columns payload");
    }
    return this.importer.importBuffer({
      buffer: file.buffer,
      mime: file.mimetype,
      columns,
      userId: user.sub,
    });
  }
}
