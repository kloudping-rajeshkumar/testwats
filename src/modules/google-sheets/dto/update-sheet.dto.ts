import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class UpdateSheetDto {
  @ApiProperty({ description: 'Google account label to use' })
  @IsString()
  @IsNotEmpty()
  tokenLabel: string;

  @ApiProperty({ description: 'Cell range in A1 notation (e.g. "Sheet1!A1:C3")' })
  @IsString()
  @IsNotEmpty()
  range: string;

  @ApiProperty({ description: 'Values to write (2D array of rows)' })
  @IsArray()
  values: string[][];

  @ApiPropertyOptional({ description: 'How to interpret input data', enum: ['RAW', 'USER_ENTERED'], default: 'USER_ENTERED' })
  @IsOptional()
  @IsString()
  valueInputOption?: 'RAW' | 'USER_ENTERED';
}
