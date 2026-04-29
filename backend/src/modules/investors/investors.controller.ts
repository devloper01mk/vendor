import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CurrentUser, type RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateInvestorEntryDto } from "./dto/create-investor-entry.dto";
import { InvestorsService } from "./investors.service";
import { UpdateInvestorEntryDto } from "./dto/update-investor-entry.dto";

@Controller("investors")
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvestorsController {
  constructor(private readonly investors: InvestorsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  list() {
    return this.investors.list();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() actor: RequestUser, @Body() body: CreateInvestorEntryDto) {
    return this.investors.create(actor, body);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  update(@Param("id") id: string, @Body() body: UpdateInvestorEntryDto) {
    return this.investors.update(id, body);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  remove(@Param("id") id: string) {
    return this.investors.remove(id);
  }
}
