import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateAuditLogDto {
  @ApiProperty({ example: 'uuid-actor', description: 'ID User yang melakukan aksi' })
  @IsString()
  @IsNotEmpty()
  actorId: string;

  @ApiProperty({ example: 'uuid-target', description: 'ID User yang datanya diakses (Opsional)', required: false })
  @IsString()
  @IsOptional()
  targetUserId?: string;

  @ApiProperty({ example: 'VIEW_EMPLOYEE_DETAIL', description: 'Jenis aksi yang dilakukan' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({ example: { score: 80 }, description: 'Metadata tambahan (JSON)', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}