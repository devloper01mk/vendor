import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from "@prisma/client/runtime/library";
import type { Response } from "express";

/** Server / network reachability. */
const CONNECTION_LIKE_CODES = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1008",
  "P1013",
  "P1017",
]);

/** Schema out of date or DB not created — distinct hint from bad credentials. */
const SCHEMA_SETUP_CODES = new Set(["P2021", "P2022", "P2010", "P1003"]);

const DB_PUSH_HINT =
  "Apply schema: npx prisma db push — or: psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -f prisma/install.sql";

@Catch(
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientValidationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger(PrismaExceptionFilter.name);

  catch(
    exception:
      | PrismaClientInitializationError
      | PrismaClientKnownRequestError
      | PrismaClientUnknownRequestError
      | PrismaClientRustPanicError
      | PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const dev = process.env.NODE_ENV !== "production";

    if (exception instanceof PrismaClientValidationError) {
      this.log.warn(exception.message);
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: dev ? exception.message : "Invalid request",
        error: "Bad Request",
      });
      return;
    }

    if (exception instanceof PrismaClientUnknownRequestError || exception instanceof PrismaClientRustPanicError) {
      this.log.error(exception.message, exception.stack);
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: dev
          ? exception.message
          : "Database query failed. Check server logs and DATABASE_URL.",
        error: "Service Unavailable",
      });
      return;
    }

    if (exception instanceof PrismaClientInitializationError) {
      const hint =
        process.env.SKIP_DATABASE === "true"
          ? "SKIP_DATABASE is set; login needs a real database. Unset SKIP_DATABASE and fix DATABASE_URL."
          : "Check DATABASE_URL and that PostgreSQL is running.";
      this.log.warn(`${exception.message} (${hint})`);
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: `Database unavailable. ${hint}`,
        error: "Service Unavailable",
      });
      return;
    }

    const known = exception as PrismaClientKnownRequestError;
    const { code, message, meta } = known;

    if (CONNECTION_LIKE_CODES.has(code)) {
      const hint =
        process.env.SKIP_DATABASE === "true"
          ? "SKIP_DATABASE is set. Run the API without it for DB access."
          : "Check DATABASE_URL and that PostgreSQL is running.";
      this.log.warn(`${message} (${hint})`);
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: `Database unavailable. ${hint}`,
        error: "Service Unavailable",
      });
      return;
    }

    if (SCHEMA_SETUP_CODES.has(code)) {
      this.log.warn(`${message} — ${DB_PUSH_HINT}`);
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: `Database setup incomplete (${code}). ${DB_PUSH_HINT}`,
        error: "Service Unavailable",
      });
      return;
    }

    if (code === "P2002") {
      res.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: "Unique constraint violation",
        error: "Conflict",
      });
      return;
    }

    this.log.error(`${code}: ${message}`, meta ? JSON.stringify(meta) : "");
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: dev ? `${code}: ${message}` : "Database error",
      error: "Internal Server Error",
    });
  }
}
