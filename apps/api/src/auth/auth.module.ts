import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import type { SignOptions } from "jsonwebtoken";
import { PassportModule } from "@nestjs/passport";
import { PrismaModule } from "../prisma/prisma.module";
import { WhatsappModule } from "../messaging/whatsapp.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { LoginBroadcastService } from "./login-broadcast.service";
import { OtpService } from "./otp.service";

@Module({
  imports: [
    PrismaModule,
    WhatsappModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET", "change-me-in-production"),
        signOptions: {
          expiresIn: config.get<string>("JWT_EXPIRES_IN", "7d") as NonNullable<
            SignOptions["expiresIn"]
          >,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LoginBroadcastService, OtpService],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
