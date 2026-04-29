import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { v4 as uuidv4 } from "uuid";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateSiteDto } from "./dto/create-site.dto";
import { UpdateSiteDto } from "./dto/update-site.dto";
import { SitesService } from "./sites.service";

const siteImageStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const dest = join(process.cwd(), "storage", "public", "sites");
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const siteId = req.params?.id ?? "site";
    cb(null, `${siteId}-${uuidv4()}${extname(file.originalname)}`);
  },
});

@Controller("sites")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  list() {
    return this.sites.list();
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  create(@Body() body: CreateSiteDto) {
    return this.sites.create(body);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  update(@Param("id") id: string, @Body() body: UpdateSiteDto) {
    return this.sites.update(id, body);
  }

  @Post(":id/image")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: siteImageStorage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = file.mimetype.startsWith("image/");
        if (!ok) {
          cb(new BadRequestException("Only image uploads allowed"), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("file is required");
    return this.sites.attachImage(id, file.filename);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  remove(@Param("id") id: string) {
    return this.sites.remove(id);
  }
}
