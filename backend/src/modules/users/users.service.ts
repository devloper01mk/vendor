import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RequirementStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/decorators/current-user.decorator";
import { AddUserPaymentDto } from "./dto/add-user-payment.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdatePaymentDto } from "./dto/update-payment.dto";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isBlocked?: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  private static readonly MEMBER_ALLOCATION_ITEM = "Member Fund Allocation";
  private static readonly RESET_REQUESTS_FILE = join(
    process.cwd(),
    "storage",
    "password-reset-requests.json",
  );

  private readResetRequests() {
    const file = UsersService.RESET_REQUESTS_FILE;
    const dir = join(process.cwd(), "storage");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(file)) return [] as Array<Record<string, unknown>>;
    try {
      return JSON.parse(readFileSync(file, "utf8")) as Array<Record<string, unknown>>;
    } catch {
      return [];
    }
  }

  private writeResetRequests(rows: Array<Record<string, unknown>>) {
    const file = UsersService.RESET_REQUESTS_FILE;
    const dir = join(process.cwd(), "storage");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(rows, null, 2), "utf8");
  }

  async ensureDefaultAdmin() {
    const email = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "Admin12345!";
    const name = process.env.ADMIN_NAME || "Admin";
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) return exists;
    const passwordHash = await bcrypt.hash(password, 12);
    return this.prisma.user.create({
      data: {
        email,
        name,
        role: UserRole.ADMIN,
        passwordHash,
        isBlocked: false,
      },
    });
  }

  findByEmailWithSecret(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  private toPublic(user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    isBlocked?: boolean;
  }): PublicUser {
    return { id: user.id, email: user.email, name: user.name, role: user.role, isBlocked: user.isBlocked };
  }

  /**
   * Google OAuth / ID token: match by `googleSub`, else email.
   * Existing ADMIN / ACCOUNT_HEAD / MEMBER rows keep role; first Google login links `googleId`.
   * New users: MEMBER, no password (Google-only).
   */
  async findOrCreateFromGoogle(
    email: string,
    displayName: string,
    googleSub: string,
  ): Promise<PublicUser> {
    const normalized = email.toLowerCase();

    const byGoogle = await this.prisma.user.findUnique({ where: { googleId: googleSub } });
    if (byGoogle) return this.toPublic(byGoogle);

    const byEmail = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (byEmail) {
      if (byEmail.googleId && byEmail.googleId !== googleSub) {
        throw new ConflictException("This email is linked to a different Google account");
      }
      const updated = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId: googleSub,
          name: displayName || byEmail.name,
        },
      });
      return this.toPublic(updated);
    }

    const created = await this.prisma.user.create({
      data: {
        email: normalized,
        name: displayName || normalized.split("@")[0] || "User",
        role: UserRole.MEMBER,
        googleId: googleSub,
        passwordHash: null,
      },
    });
    return this.toPublic(created);
  }

  async createByAdmin(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException("Email already registered");
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        role: dto.role ?? UserRole.MEMBER,
        passwordHash,
        isBlocked: true,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async updateByAdmin(id: string, dto: UpdateUserDto) {
    const data: Prisma.UserUpdateInput = {
      ...(dto.email ? { email: dto.email.toLowerCase() } : {}),
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.role ? { role: dto.role } : {}),
    };

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: { id: true, email: true, name: true, role: true, isBlocked: true, createdAt: true },
      });
    } catch {
      throw new NotFoundException("User not found");
    }
  }

  async resetPasswordByAdmin(id: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      await this.prisma.user.update({
        where: { id },
        data: { passwordHash },
      });
      return { ok: true };
    } catch {
      throw new NotFoundException("User not found");
    }
  }

  async list() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isBlocked: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, isBlocked: true, createdAt: true },
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async getMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, isBlocked: true, createdAt: true },
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async createPasswordResetRequest(email: string, note?: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user || user.role !== UserRole.MEMBER) {
      // Keep response generic for privacy.
      return { ok: true, message: "If this account exists, your request has been sent to admin." };
    }

    const rows = this.readResetRequests();
    rows.unshift({
      id: `prr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      email: user.email,
      name: user.name,
      note: note?.trim() || null,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null,
    });
    this.writeResetRequests(rows);
    return { ok: true, message: "Password reset request sent to admin." };
  }

  listPasswordResetRequests() {
    return this.readResetRequests();
  }

  resolvePasswordResetRequest(requestId: string, adminEmail: string) {
    const rows = this.readResetRequests();
    const next = rows.map((row) =>
      row.id === requestId
        ? {
            ...row,
            status: "RESOLVED",
            resolvedAt: new Date().toISOString(),
            resolvedBy: adminEmail,
          }
        : row,
    );
    this.writeResetRequests(next);
    return { ok: true };
  }

  async updateMe(id: string, dto: UpdateMeDto) {
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, isBlocked: true, createdAt: true },
    });
    return updated;
  }

  async changeMyPassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    // For Google-only users, allow setting a first password.
    if (user.passwordHash) {
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) throw new BadRequestException("Current password is incorrect");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { ok: true };
  }

  setBlocked(id: string, blocked: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isBlocked: blocked },
      select: { id: true, email: true, name: true, role: true, isBlocked: true, createdAt: true },
    });
  }

  async addPaymentForUser(userId: string, actor: RequestUser, dto: AddUserPaymentDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("User not found");
    const [vendor, site] = await Promise.all([
      this.prisma.vendor.findFirst({ where: { name: "General Vendor" } }),
      this.prisma.site.findFirst({ where: { name: "General Site" } }),
    ]);

    const resolvedVendor =
      vendor ??
      (await this.prisma.vendor.create({
        data: { name: "General Vendor", address: "Auto-created by system" },
      }));
    const resolvedSite =
      site ??
      (await this.prisma.site.create({
        data: { name: "General Site", address: "Auto-created by system" },
      }));

    let allocationRequirement = await this.prisma.requirement.findFirst({
      where: {
        createdById: userId,
        itemName: UsersService.MEMBER_ALLOCATION_ITEM,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, totalAmount: true },
    });

    if (!allocationRequirement) {
      allocationRequirement = await this.prisma.requirement.create({
        data: {
          itemName: UsersService.MEMBER_ALLOCATION_ITEM,
          brand: "N/A",
          quantity: new Prisma.Decimal(1),
          totalAmount: new Prisma.Decimal(0),
          status: RequirementStatus.PENDING,
          billReceived: false,
          entryDate: new Date(),
          notes: "System bucket for member fund allocations",
          vendorId: resolvedVendor.id,
          siteId: resolvedSite.id,
          createdById: userId,
        },
        select: { id: true, totalAmount: true },
      });
    }

    const amount = new Prisma.Decimal(dto.amount);

    await this.prisma.payment.create({
      data: {
        requirementId: allocationRequirement.id,
        recordedById: actor.sub,
        amount,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        method: dto.method,
        note:
          dto.note?.trim() ||
          `Fund allocated by ${actor.role} (${actor.email || actor.sub})`,
      },
    });

    await this.prisma.requirement.update({
      where: { id: allocationRequirement.id },
      data: { totalAmount: allocationRequirement.totalAmount.add(amount) },
    });

    return { ok: true };
  }

  async listUserPayments(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isBlocked: true, createdAt: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const allocationPayments = await this.prisma.payment.findMany({
      where: {
        requirement: {
          createdById: userId,
          itemName: UsersService.MEMBER_ALLOCATION_ITEM,
        },
      },
      orderBy: { paidAt: "desc" },
      include: {
        recordedBy: { select: { id: true, name: true, email: true } },
        requirement: {
          select: {
            id: true,
            itemName: true,
            totalAmount: true,
            status: true,
            entryDate: true,
            payments: {
              select: { id: true, amount: true },
            },
          },
        },
      },
    });

    const requirements = await this.prisma.requirement.findMany({
      where: {
        createdById: userId,
        itemName: { not: UsersService.MEMBER_ALLOCATION_ITEM },
      },
      orderBy: { entryDate: "desc" },
      include: {
        payments: { select: { amount: true } },
      },
    });

    const totalAmount = allocationPayments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
    const totalPaid = requirements.reduce((sum, r) => {
      const requirementPaid = r.payments.reduce((innerSum, row) => innerSum.add(row.amount), new Prisma.Decimal(0));
      return sum.add(requirementPaid);
    }, new Prisma.Decimal(0));
    const totalRemaining = totalAmount.sub(totalPaid);

    return {
      user,
      summary: {
        totalAmount: totalAmount.toString(),
        totalPaid: totalPaid.toString(),
        remainingAmount: totalRemaining.toString(),
      },
      requirements: requirements.map((r) => {
        const paid = r.payments.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
        return {
          id: r.id,
          itemName: r.itemName,
          totalAmount: r.totalAmount.toString(),
          paidTotal: paid.toString(),
          remaining: r.totalAmount.sub(paid).toString(),
          status: r.status,
          entryDate: r.entryDate,
        };
      }),
      payments: allocationPayments.map((p) => {
        return {
          id: p.id,
          amount: p.amount.toString(),
          paidAt: p.paidAt,
          method: p.method,
          note: p.note,
          createdAt: p.createdAt,
          recordedBy: p.recordedBy,
          requirement: {
            id: p.requirement.id,
            itemName: p.requirement.itemName,
            totalAmount: p.requirement.totalAmount.toString(),
            status: p.requirement.status,
            entryDate: p.requirement.entryDate,
            paidTotal: p.amount.toString(),
            remaining: "0",
          },
        };
      }),
    };
  }

  async updatePayment(paymentId: string, dto: UpdatePaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        requirement: {
          include: {
            payments: true,
          },
        },
      },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.requirement.itemName !== UsersService.MEMBER_ALLOCATION_ITEM) {
      throw new BadRequestException(
        "Only admin-to-member allocation payments can be updated from User Payment History",
      );
    }

    const updatedAmount = new Prisma.Decimal(dto.amount);
    const oldAmount = payment.amount;

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        amount: updatedAmount,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        method: dto.method !== undefined ? dto.method : undefined,
        note: dto.note !== undefined ? dto.note : undefined,
      },
      include: {
        recordedBy: { select: { id: true, name: true, email: true } },
        requirement: {
          include: {
            payments: true,
          },
        },
      },
    });

    await this.prisma.requirement.update({
      where: { id: updated.requirementId },
      data: { totalAmount: updated.requirement.totalAmount.sub(oldAmount).add(updatedAmount) },
    });

    const nextTotalForReturn = updatedAmount;
    const remaining = updated.requirement.totalAmount.sub(nextTotalForReturn);
    return {
      id: updated.id,
      amount: updated.amount.toString(),
      paidAt: updated.paidAt,
      method: updated.method,
      note: updated.note,
      createdAt: updated.createdAt,
      recordedBy: updated.recordedBy,
      requirement: {
        id: updated.requirement.id,
        itemName: updated.requirement.itemName,
        totalAmount: updated.requirement.totalAmount.toString(),
        paidTotal: nextTotalForReturn.toString(),
        remaining: remaining.toString(),
        status: updated.requirement.status,
      },
    };
  }

  async deletePayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { requirement: { select: { id: true, itemName: true, totalAmount: true } } },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.requirement.itemName !== UsersService.MEMBER_ALLOCATION_ITEM) {
      throw new BadRequestException(
        "Only admin-to-member allocation payments can be deleted from User Payment History",
      );
    }

    await this.prisma.payment.delete({ where: { id: paymentId } });
    await this.prisma.requirement.update({
      where: { id: payment.requirementId },
      data: { totalAmount: payment.requirement.totalAmount.sub(payment.amount) },
    });

    return { ok: true };
  }
}
