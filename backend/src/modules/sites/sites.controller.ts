import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateSiteDto } from "./dto/create-site.dto";
import { UpdateSiteDto } from "./dto/update-site.dto";
import { SitesService } from "./sites.service";

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

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  remove(@Param("id") id: string) {
    return this.sites.remove(id);
  }
}
