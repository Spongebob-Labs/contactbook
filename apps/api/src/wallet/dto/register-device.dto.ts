import { IsString, IsNotEmpty } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  pushToken!: string;
}
