import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CurrentUser, type RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AddUserPaymentDto } from "./dto/add-user-payment.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { SetBlockedDto } from "./dto/set-blocked.dto";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  list() {
    return this.users.list();
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  getOne(@Param("id") id: string) {
    return this.users.getOne(id);
  }

  @Get(":id/payments")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  listUserPayments(@Param("id") id: string) {
    return this.users.listUserPayments(id);
  }

  @Post(":id/payments")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  addUserPayment(
    @Param("id") id: string,
    @CurrentUser() actor: RequestUser,
    @Body() body: AddUserPaymentDto,
  ) {
    return this.users.addPaymentForUser(id, actor, body);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() body: CreateUserDto) {
    return this.users.createByAdmin(body);
  }

  @Patch(":id/blocked")
  @Roles(UserRole.ADMIN)
  setBlocked(@Param("id") id: string, @Body() body: SetBlockedDto) {
    return this.users.setBlocked(id, body.blocked);
  }

  @Patch("payments/:paymentId")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  updatePayment(@Param("paymentId") paymentId: string, @Body() body: UpdatePaymentDto) {
    return this.users.updatePayment(paymentId, body);
  }

  @Delete("payments/:paymentId")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  deletePayment(@Param("paymentId") paymentId: string) {
    return this.users.deletePayment(paymentId);
  }
}
