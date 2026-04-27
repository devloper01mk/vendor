import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    _context: ExecutionContext,
    _status?: any,
  ): TUser {
    if (err || !user) {
      console.log("[JWT GUARD] err:", err);
      console.log("[JWT GUARD] info:", info);
      throw err || new UnauthorizedException("Unauthorized");
    }
    return user as TUser;
  }
}










