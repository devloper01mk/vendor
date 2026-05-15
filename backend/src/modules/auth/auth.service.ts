
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { UserRole } from "@prisma/client";
import type { PublicUser } from "../users/users.service";
import { UsersService } from "../users/users.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async validateCredentials(email: string, password: string): Promise<PublicUser> {
    const user = await this.users.findByEmailWithSecret(email);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    if ((user as { isBlocked?: boolean }).isBlocked) {
      throw new UnauthorizedException("Account is blocked");
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException("This account uses Google sign-in");
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  /**
   * Issue JWT + normalized user for password login, Google redirect, and mobile ID token.
   * Mobile clients use a longer TTL so daily reopen does not force re-login (web stays short-lived).
   */
  async issueSession(user: PublicUser, opts?: { longLived: boolean }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
    };

    const signingSecret = process.env.JWT_SECRET ?? "dev-secret-change-me";
    console.log("[JWT SIGN] secret source:", process.env.JWT_SECRET ? "env" : "fallback");
    console.log("[JWT SIGN] secret preview:", `${signingSecret.slice(0, 4)}...${signingSecret.slice(-4)}`);
    console.log("[JWT SIGN] payload:", payload);
    const mobileTtl = process.env.JWT_MOBILE_EXPIRES_IN ?? "30d";
    const accessToken = await this.jwt.signAsync(
      payload,
      opts?.longLived ? { expiresIn: mobileTtl } : {},
    );
    console.log("[JWT SIGN] token preview:", `${accessToken.slice(0, 20)}...`);
    return { user, accessToken };
  }

  async login(email: string, password: string) {
    const user = await this.validateCredentials(email, password);
    if (user.role !== UserRole.MEMBER) {
      throw new UnauthorizedException("Only MEMBER users can log in from the mobile app");
    }
    return this.issueSession(user, { longLived: true });
  }

  /**
   * Browser password login (admins/account heads can use this).
   * Mobile password login remains restricted to MEMBER via `login()`.
   */
  async loginWeb(email: string, password: string) {
    const user = await this.validateCredentials(email, password);
    return this.issueSession(user);
  }

  async loginWithGoogleProfile(email: string, displayName: string, googleSub: string) {
    const user = await this.users.findOrCreateFromGoogle(email, displayName, googleSub);
    if ((user as { isBlocked?: boolean }).isBlocked) {
      throw new UnauthorizedException("Account is blocked");
    }
    return this.issueSession(user, { longLived: true });
  }

  /** Native / Expo apps: exchange Google Sign-In ID token for our JWT. */
  async loginWithGoogleIdToken(idToken: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new UnauthorizedException("Google Sign-In is not configured");
    }
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    const email = payload?.email;
    if (!email) {
      throw new UnauthorizedException("Google did not return an email");
    }
    if (payload.email_verified === false) {
      throw new UnauthorizedException("Google email is not verified");
    }
    const sub = payload.sub;
    if (!sub) {
      throw new UnauthorizedException("Invalid Google token");
    }
    const name = payload.name ?? email.split("@")[0]!;
    return this.loginWithGoogleProfile(email, name, sub);
  }
}