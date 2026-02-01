import {
    Controller,
    Post,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
    HttpStatus,
    HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { MediaStorageService } from '../services/media-storage.service';

@ApiTags('Admin - Media Management')
@Controller('admin/media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.DIRECTOR) // Hanya Admin yang boleh upload aset
@ApiBearerAuth()
export class MediaController {
    constructor(private readonly mediaService: MediaStorageService) { }

    @Post('upload')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Upload image asset (Max 2MB, JPG/PNG/WEBP)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Image file for module thumbnail or illustration',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    // 1. Size Validation: Max 2MB (2 * 1024 * 1024)
                    // File edukasi harus ringan agar mobile-friendly
                    new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }),

                    // 2. Type Validation: Image only
                    // Regex menangkap jpeg, jpg, png, webp
                    new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
                ],
            }),
        )
        file: Express.Multer.File,
    ) {
        const result = await this.mediaService.uploadFile(file);

        return {
            message: 'File uploaded successfully',
            data: result, // { url: '/uploads/uuid.jpg', ... }
        };
    }
}