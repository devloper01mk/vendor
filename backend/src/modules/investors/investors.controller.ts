import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CurrentUser, type RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateInvestorEntryDto } from "./dto/create-investor-entry.dto";
import { InvestorsService } from "./investors.service";

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
}
