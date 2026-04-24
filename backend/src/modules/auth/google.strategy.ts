import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy } from "passport-google-oauth20";
import type { PublicUser } from "../users/users.service";
import { UsersService } from "../users/users.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private readonly users: UsersService) {
    super({
      /* Empty strings in .env are invalid for OAuth2Strategy — use placeholders until real IDs are set. */
      clientID: process.env.GOOGLE_CLIENT_ID?.trim() || "not-configured",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || "not-configured",
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:4000/auth/google/callback",
      scope: ["email", "profile"],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<PublicUser> {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new UnauthorizedException("Google Sign-In is not configured on the server");
    }
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException("Google did not return an email address");
    }
    const name =
      profile.displayName ||
      [profile.name?.givenName, profile.name?.familyName].filter(Boolean).join(" ") ||
      email;
    const googleSub = profile.id;
    if (!googleSub) {
      throw new UnauthorizedException("Google did not return a user id");
    }
    return this.users.findOrCreateFromGoogle(email, name, googleSub);
  }
}
