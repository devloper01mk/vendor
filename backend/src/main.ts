import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { json, urlencoded } from "express";
import { join } from "path";
import { AppModule } from "./app.module";
import { UsersService } from "./modules/users/users.service";
import { PrismaExceptionFilter } from "./prisma/prisma-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
  });

  const publicDir = join(process.cwd(), "storage", "public");
  app.useStaticAssets(publicDir, { prefix: "/uploads/" });

  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true, limit: "10mb" }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new PrismaExceptionFilter());

  app.getHttpAdapter().get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      database: process.env.SKIP_DATABASE === "true" ? "skipped" : "connected",
    });
  });

  // Keep a default admin account available for first login.
  await app.get(UsersService).ensureDefaultAdmin();

  const initialPort = Number(process.env.PORT ?? "4000");
  const maxPortAttempts = 10;
  let activePort = initialPort;

  for (let attempt = 0; attempt < maxPortAttempts; attempt += 1) {
    try {
      await app.listen(activePort);
      Logger.log(`API http://localhost:${activePort}`, "Bootstrap");
      return;
    } catch (error) {
      const isAddressInUse =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "EADDRINUSE";
      if (!isAddressInUse || attempt === maxPortAttempts - 1) {
        throw error;
      }
      activePort += 1;
      Logger.warn(`Port ${activePort - 1} is in use, retrying on ${activePort}`, "Bootstrap");
    }
  }
}

bootstrap();
