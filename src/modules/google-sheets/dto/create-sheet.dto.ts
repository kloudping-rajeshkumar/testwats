import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateSheetDto {
  @ApiProperty({ description: 'Google account label to use' })
  @IsString()
  @IsNotEmpty()
  tokenLabel: string;

  @ApiProperty({ description: 'Title of the spreadsheet' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Sheet tab names to create', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sheetNames?: string[];

  @ApiPropertyOptional({ description: 'Header row values for the first sheet', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  headers?: string[];
}
