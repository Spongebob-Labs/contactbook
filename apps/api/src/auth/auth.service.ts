import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { OtpService } from "./otp.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
  ) {}

  async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<{ accessToken: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException("Email already registered");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash, name },
    });
    return { accessToken: this.sign(user.id, user.email) };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return { accessToken: this.sign(user.id, user.email) };
  }

  async sendPhoneOtp(userId: string, phoneE164: string): Promise<void> {
    await this.otp.sendPhoneOtp(userId, phoneE164);
  }

  async verifyPhoneOtp(
    userId: string,
    phoneE164: string,
    code: string,
  ): Promise<void> {
    await this.otp.verifyPhoneOtp(userId, phoneE164, code);
  }

  private sign(sub: string, email: string): string {
    return this.jwt.sign({ sub, email });
  }
}
