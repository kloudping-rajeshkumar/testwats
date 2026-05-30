import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class AppendRowsDto {
  @ApiProperty({ description: 'Google account label to use' })
  @IsString()
  @IsNotEmpty()
  tokenLabel: string;

  @ApiPropertyOptional({ description: 'Range to append to (e.g. "Sheet1")', default: 'Sheet1' })
  @IsOptional()
  @IsString()
  range?: string;

  @ApiProperty({ description: 'Rows to append (2D array)' })
  @IsArray()
  values: string[][];
}
