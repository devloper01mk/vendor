import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { CurrentUser, type RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { VendorsService } from "./vendors.service";

const vendorImageStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const dest = join(process.cwd(), "storage", "public", "vendors");
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const vendorId = req.params?.id ?? "vendor";
    cb(null, `${vendorId}-${uuidv4()}${extname(file.originalname)}`);
  },
});

@Controller("vendors")
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  list(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("memberId") memberId?: string,
    @Query("search") search?: string,
  ) {
    return this.vendors.listWithBalances(user, from, to, memberId, search);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  create(@Body() body: CreateVendorDto) {
    return this.vendors.create(body);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  update(@Param("id") id: string, @Body() body: UpdateVendorDto) {
    return this.vendors.update(id, body);
  }

  @Post(":id/image")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: vendorImageStorage,
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
    return this.vendors.attachImage(id, file.filename);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  remove(@Param("id") id: string) {
    return this.vendors.remove(id);
  }
}
