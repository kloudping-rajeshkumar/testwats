import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum } from 'class-validator';

export enum ShareRole {
  READER = 'reader',
  WRITER = 'writer',
  COMMENTER = 'commenter',
}

export class ShareSheetDto {
  @ApiProperty({ description: 'Google account label to use' })
  @IsString()
  @IsNotEmpty()
  tokenLabel: string;

  @ApiProperty({ description: 'Email address to share with' })
  @IsEmail()
  emailAddress: string;

  @ApiPropertyOptional({ description: 'Permission role', enum: ShareRole, default: ShareRole.READER })
  @IsOptional()
  @IsEnum(ShareRole)
  role?: ShareRole;

  @ApiPropertyOptional({ description: 'Send a notification email', default: true })
  @IsOptional()
  sendNotification?: boolean;

  @ApiPropertyOptional({ description: 'Custom message in the notification email' })
  @IsOptional()
  @IsString()
  message?: string;
}
