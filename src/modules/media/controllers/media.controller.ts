import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    Res,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    HttpStatus,
    HttpCode,
    BadRequestException,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
    StreamableFile,
    NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { MediaStorageService } from '../services/media-storage.service';
import express from 'express';
import { join } from 'path';
import { createReadStream, existsSync } from 'fs';

@ApiTags('Media Management')
@Controller('media')
export class MediaController {
    constructor(private readonly mediaService: MediaStorageService) { }

    // --- 1. UPLOAD ENDPOINT ---
    @Post('upload')
    @UseGuards(JwtAuthGuard) // Siapapun yang login boleh upload bukti bayar
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Upload single image asset (Max 2MB, JPG/PNG/WEBP)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File gambar binary. Maksimal 2MB.',
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'File berhasil diunggah.' })
    @ApiResponse({ status: 400, description: 'Validasi file gagal (Ukuran/Tipe).' })
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({
                        maxSize: 2 * 1024 * 1024,
                        message: 'File terlalu besar. Maksimal ukuran yang diizinkan adalah 2MB.'
                    }),
                    new FileTypeValidator({
                        fileType: /image\/(jpeg|jpg|png|webp)/,
                    }),
                ],
                errorHttpStatusCode: HttpStatus.BAD_REQUEST,
            }),
        )
        file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('File tidak ditemukan dalam request.');
        }

        // Delegasi ke Service
        const result = await this.mediaService.uploadFile(file, 'media');

        return {
            status: 'success',
            message: 'File uploaded successfully',
            data: result,
        };
    }

    // --- 2. SERVE STATIC FILE (Private / Protected) ---
    @Get(':filename')
    @UseGuards(JwtAuthGuard) // Hanya user login yang bisa lihat
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get/Download file by filename' })
    @ApiParam({ name: 'filename', type: 'string', description: 'Nama file yang tersimpan di server' })
    async getFile(@Param('filename') filename: string, @Res({ passthrough: true }) res: express.Response): Promise<StreamableFile> {

        // Sanitasi Path (Security)
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            throw new BadRequestException('Filename tidak valid.');
        }

        // Lokasi file (sesuaikan dengan logic service Anda, misal di root/uploads/media)
        const filePath = join(process.cwd(), 'uploads', 'media', filename);

        if (!existsSync(filePath)) {
            throw new NotFoundException('File tidak ditemukan.');
        }

        const fileStream = createReadStream(filePath);

        // Set Header Content-Type otomatis berdasarkan ekstensi
        // (NestJS StreamableFile handle basic, tapi express res lebih fleksibel)
        res.set({
            'Content-Type': 'image/jpeg', // Bisa dibuat dinamis pakai mime-types lib jika perlu
            'Content-Disposition': `inline; filename="${filename}"`,
        });

        return new StreamableFile(fileStream);
    }

    // --- 3. DELETE ENDPOINT (Admin Only) ---
    @Delete()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete media file by path (Garbage Collection)' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    example: 'media/550e8400-e29b-41d4-a716-446655440000.jpg',
                    description: 'Relative path file yang akan dihapus.'
                }
            }
        }
    })
    async deleteFile(@Body('path') path: string) {
        if (!path) {
            throw new BadRequestException('Path file wajib diisi.');
        }

        if (path.includes('..')) {
            throw new BadRequestException('Invalid path format.');
        }

        await this.mediaService.deleteFile(path);

        return {
            status: 'success',
            message: 'File deleted successfully',
        };
    }
}