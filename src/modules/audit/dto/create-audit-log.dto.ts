import { IsString, IsNotEmpty, IsOptional, IsUUID, IsObject } from 'class-validator';

export class CreateAuditLogDto {
  @IsUUID('4', { message: 'Actor ID harus berupa UUID valid' })
  @IsNotEmpty()
  actorId: string;

  @IsUUID('4', { message: 'Target User ID harus berupa UUID valid' })
  @IsOptional()
  targetUserId?: string; // Optional: Karena tidak semua aksi melibatkan user lain

  @IsString()
  @IsNotEmpty()
  action: string; // Contoh: "VIEW_DETAIL", "EXPORT_PDF"

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>; // Fleksibel untuk menyimpan IP, User Agent, atau Snapshot data
}