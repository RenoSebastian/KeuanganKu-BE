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
    FileValidator, // [TAMBAHAN] Import FileValidator dasar
    StreamableFile,
    NotFoundException,
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
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
import { Observable } from 'rxjs';

/**
 * DEBUG INTERCEPTOR
 * Digunakan untuk mengintip data file mentah dari Multer 
 * sebelum dievaluasi oleh ParseFilePipe.
 */
@Injectable()
class FileDebugInterceptor implements NestInterceptor {
    private readonly logger = new Logger('FileDebug');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const file = request.file;

        if (file) {
            this.logger.debug('=== [RAW FILE DATA FROM FE] ===');
            this.logger.debug(`Field: ${file.fieldname}`);
            this.logger.debug(`Name: ${file.originalname}`);
            this.logger.debug(`MIME: ${file.mimetype}`);
            this.logger.debug(`Size: ${file.size} bytes`);
            this.logger.debug('==============================');
        } else {
            this.logger.warn('Warning: No file detected in request object!');
        }

        return next.handle();
    }
}

/**
 * [IMPLEMENTASI BARU] SAFE MIME TYPE VALIDATOR
 * Custom validator kelas rendah (low-level) untuk mem-Bypass proses ekstraksi 
 * Magic Numbers dari pustaka 'file-type' NestJS yang mengalami crash akibat ESM conflict.
 */
export class SafeMimeTypeValidator extends FileValidator<Record<string, any>> {
    buildErrorMessage(): string {
        return 'Format file tidak didukung. Pastikan format adalah JPG, PNG, atau WEBP.';
    }

    isValid(file?: Express.Multer.File): boolean {
        if (!file || !file.mimetype) {
            return false;
        }
        // Mengeksekusi pengecekan murni menggunakan pola komputasi Regex
        // tanpa memicu engine file-type NestJS.
        const mimeRegex = /image\/(jpeg|jpg|png|webp)/i;
        return mimeRegex.test(file.mimetype);
    }
}

@ApiTags('Media Management')
@Controller('media')
export class MediaController {
    constructor(private readonly mediaService: MediaStorageService) { }

    // --- 1. UPLOAD ENDPOINT ---
    @Post('upload')
    @UseGuards(JwtAuthGuard)
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
    @UseInterceptors(FileInterceptor('file'), FileDebugInterceptor)
    async uploadFile(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({
                        maxSize: 2 * 1024 * 1024,
                        message: 'File terlalu besar. Maksimal ukuran yang diizinkan adalah 2MB.'
                    }),
                    // [UBAH] Implementasikan custom validator terisolasi kita
                    new SafeMimeTypeValidator({}),
                ],
                exceptionFactory: (error) => {
                    Logger.error(`Validation Failure Logic: ${error}`, 'MediaController');

                    const isSizeError = error.toLowerCase().includes('size') || error.toLowerCase().includes('besar');
                    if (isSizeError) {
                        return new BadRequestException('Ukuran file terlalu besar. Maksimal 2MB.');
                    }

                    return new BadRequestException('Format file tidak didukung. Pastikan format adalah JPG, PNG, atau WEBP.');
                },
                errorHttpStatusCode: HttpStatus.BAD_REQUEST,
            }),
        )
        file: Express.Multer.File,
    ) {
        console.log(`>>> PASSED VALIDATION: ${file.originalname}`);

        const result = await this.mediaService.uploadFile(file, 'media');

        return {
            status: 'success',
            message: 'File uploaded successfully',
            data: result,
        };
    }

    // --- 2. SERVE STATIC FILE ---
    @Get(':filename')
    // @UseGuards(JwtAuthGuard)  <-- Hapus atau beri komentar baris ini
    // @ApiBearerAuth()          <-- Hapus atau beri komentar baris ini
    @ApiOperation({ summary: 'Get/Download file by filename' })
    @ApiParam({ name: 'filename', type: 'string', description: 'Nama file yang tersimpan di server' })
    async getFile(@Param('filename') filename: string, @Res({ passthrough: true }) res: express.Response): Promise<StreamableFile> {

        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            throw new BadRequestException('Filename tidak valid.');
        }

        const filePath = join(process.cwd(), 'uploads', 'media', filename);

        if (!existsSync(filePath)) {
            throw new NotFoundException('File tidak ditemukan.');
        }

        const fileStream = createReadStream(filePath);

        res.set({
            'Content-Type': 'image/jpeg',
            'Content-Disposition': `inline; filename="${filename}"`,
        });

        return new StreamableFile(fileStream);
    }

    // --- 3. DELETE ENDPOINT ---
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