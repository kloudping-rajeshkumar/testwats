import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ConnectGoogleDto {
  @ApiProperty({ description: 'A unique label for this Google account (e.g. "work", "personal")' })
  @IsString()
  @IsNotEmpty()
  label: string;
}
