import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

function skipDatabase(): boolean {
  return process.env.SKIP_DATABASE === "true";
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PrismaService.name);

  constructor() {
    if (skipDatabase()) {
      /** Placeholder URL so Prisma Client can construct when DATABASE_URL is unset. */
      super({
        datasources: {
          db: {
            url: process.env.DATABASE_URL ?? "postgresql://skip:skip@127.0.0.1:1/skipdb",
          },
        },
      });
    } else {
      super();
    }
  }

  async onModuleInit() {
    if (skipDatabase()) {
      this.log.warn("SKIP_DATABASE=true — Prisma not connected; API routes that use the DB will fail");
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    if (skipDatabase()) {
      return;
    }
    await this.$disconnect();
  }
}
