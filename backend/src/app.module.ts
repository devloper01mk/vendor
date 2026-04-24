import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { VendorsModule } from "./modules/vendors/vendors.module";
import { SitesModule } from "./modules/sites/sites.module";
import { RequirementsModule } from "./modules/requirements/requirements.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ImportModule } from "./modules/import/import.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env.local", ".env"] }),
    PrismaModule,
    AuthModule,
    UsersModule,
    VendorsModule,
    SitesModule,
    RequirementsModule,
    DashboardModule,
    ImportModule,
  ],
})
export class AppModule {}
