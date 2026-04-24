import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type RequestUser = { sub: string; email: string; role: string; name?: string };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    return ctx.switchToHttp().getRequest().user as RequestUser;
  },
);
