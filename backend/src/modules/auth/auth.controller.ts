import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { GoogleIdTokenDto } from "./dto/google-id-token.dto";
import { LoginDto } from "./dto/login.dto";
import type { PublicUser } from "../users/users.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body() body: LoginDto, @Headers("x-client-platform") platform?: string) {
    // Default to web for browser calls (older clients may omit the header).
    const p = platform ?? "web";
    if (p === "mobile") {
      return this.auth.login(body.email, body.password);
    }
    if (p === "web") {
      return this.auth.loginWeb(body.email, body.password);
    }
    throw new UnauthorizedException("Unknown client platform");
  }

  /** Browser: redirects to Google, then to FRONTEND_URL/auth/callback?accessToken=… */
  @Get("google")
  @UseGuards(AuthGuard("google"))
  googleAuth() {
    return;
  }

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as PublicUser;
    const { accessToken } = await this.auth.issueSession(user);
    const frontend = process.env.FRONTEND_URL ?? "http://localhost:3000";
    const url = `${frontend}/auth/callback?accessToken=${encodeURIComponent(accessToken)}`;
    return res.redirect(302, url);
  }

  /** Mobile / native: Google Sign-In returns an ID token — exchange for our JWT. */
  @Post("google/token")
  async googleToken(@Body() body: GoogleIdTokenDto) {
    const session = await this.auth.loginWithGoogleIdToken(body.idToken);
    if (session.user.role !== "MEMBER") {
      throw new UnauthorizedException("Only MEMBER users can log in from the mobile app");
    }
    return session;
  }
}
