import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class EditUserDto {
  @ApiPropertyOptional({ example: 'Budi Santoso, S.Kom' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsDateString() // Format YYYY-MM-DD
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsInt()
  @IsOptional()
  dependentCount?: number;
}