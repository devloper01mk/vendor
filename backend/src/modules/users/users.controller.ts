import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CurrentUser, type RequestUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AddUserPaymentDto } from "./dto/add-user-payment.dto";
import { ChangeMyPasswordDto } from "./dto/change-my-password.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SetBlockedDto } from "./dto/set-blocked.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
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

  @Get("password-reset-requests")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  listPasswordResetRequests() {
    return this.users.listPasswordResetRequests();
  }

  @Patch("password-reset-requests/:requestId/resolve")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  resolvePasswordResetRequest(
    @Param("requestId") requestId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.users.resolvePasswordResetRequest(requestId, user.email);
  }

  @Get("me")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  me(@CurrentUser() user: RequestUser) {
    return this.users.getMe(user.sub);
  }

  @Patch("me")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  updateMe(@CurrentUser() user: RequestUser, @Body() body: UpdateMeDto) {
    return this.users.updateMe(user.sub, body);
  }

  @Patch("me/password")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD, UserRole.MEMBER)
  changeMyPassword(@CurrentUser() user: RequestUser, @Body() body: ChangeMyPasswordDto) {
    return this.users.changeMyPassword(user.sub, body.currentPassword, body.newPassword);
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
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  create(@Body() body: CreateUserDto) {
    return this.users.createByAdmin(body);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  update(@Param("id") id: string, @Body() body: UpdateUserDto) {
    return this.users.updateByAdmin(id, body);
  }

  @Patch(":id/reset-password")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_HEAD)
  resetPassword(@Param("id") id: string, @Body() body: ResetPasswordDto) {
    return this.users.resetPasswordByAdmin(id, body.password);
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
