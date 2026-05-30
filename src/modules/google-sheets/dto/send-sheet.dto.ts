import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum SendFormat {
  LINK = 'link',
  PDF = 'pdf',
  XLSX = 'xlsx',
}

export class SendSheetDto {
  @ApiProperty({ description: 'Google account label to use' })
  @IsString()
  @IsNotEmpty()
  tokenLabel: string;

  @ApiProperty({ description: 'WhatsApp session ID' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: 'WhatsApp chat ID (e.g. 628xxx@c.us)' })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiPropertyOptional({ description: 'Send as link, PDF, or Excel file', enum: SendFormat, default: SendFormat.LINK })
  @IsOptional()
  @IsEnum(SendFormat)
  format?: SendFormat;

  @ApiPropertyOptional({ description: 'Caption/message to send with the sheet' })
  @IsOptional()
  @IsString()
  caption?: string;
}
