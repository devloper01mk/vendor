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
import { Prisma, UserRole } from "@prisma/client";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { v4 as uuidv4 } from "uuid";
import { CurrentUser, type RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AddPaymentDto } from "./dto/add-payment.dto";
import { CreateRequirementDto } from "./dto/create-requirement.dto";
import { ListRequirementsQueryDto } from "./dto/list-requirements.query.dto";
import { ToggleHighlightDto } from "./dto/toggle-highlight.dto";
import { UpdateRequirementDto } from "./dto/update-requirement.dto";
import { UpdateRequirementPaymentDto } from "./dto/update-requirement-payment.dto";
import { RequirementsService } from "./requirements.service";

const invoiceStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const dest = join(process.cwd(), "storage", "public", "invoices");
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${extname(file.originalname)}`);
  },
});

@Controller("requirements")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RequirementsController {
  constructor(private readonly requirements: RequirementsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  list(@CurrentUser() user: RequestUser, @Query() query: ListRequirementsQueryDto) {
    return this.requirements.list(user, query);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  getOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.requirements.getOne(id, user);
  }

  @Post()
  @Roles(UserRole.MEMBER)
  create(@CurrentUser() user: RequestUser, @Body() body: CreateRequirementDto) {
    return this.requirements.create(user.sub, body);
  }

  @Patch(":id")
  @Roles(UserRole.MEMBER)
  update(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateRequirementDto,
  ) {
    return this.requirements.update(id, user.sub, body);
  }

  @Patch(":id/highlight")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  toggleHighlight(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: ToggleHighlightDto,
  ) {
    return this.requirements.toggleHighlight(id, user, body);
  }

  @Delete(":id")
  @Roles(UserRole.MEMBER)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.requirements.remove(id, user);
  }

  @Post(":id/payments")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  addPayment(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: AddPaymentDto,
  ) {
    return this.requirements.addPayment(id, user, body);
  }

  @Patch("payments/:paymentId")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  updatePayment(
    @Param("paymentId") paymentId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateRequirementPaymentDto,
  ) {
    return this.requirements.updatePayment(paymentId, user, body);
  }

  @Post(":id/invoice")
  @Roles(UserRole.MEMBER)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: invoiceStorage,
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype === "application/pdf" ||
          file.mimetype.startsWith("image/");
        if (!ok) {
          cb(new BadRequestException("Only PDF or image uploads allowed"), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadInvoice(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body("gstDetails") gstDetailsRaw?: string,
  ) {
    if (!file) throw new BadRequestException("file is required");
    let gstDetails: unknown | undefined;
    if (gstDetailsRaw) {
      try {
        gstDetails = JSON.parse(gstDetailsRaw);
      } catch {
        throw new BadRequestException("gstDetails must be valid JSON");
      }
    }
    return this.requirements.attachInvoice(
      id,
      user.sub,
      {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
      },
      gstDetails as Prisma.JsonValue | undefined,
    );
  }
}
