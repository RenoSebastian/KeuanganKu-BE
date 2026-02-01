import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MediaStorageService {
    private readonly logger = new Logger(MediaStorageService.name);

    // Konfigurasi lokasi upload (Local Storage Strategy)
    // Di masa depan, ini bisa diganti menjadi bucket name S3
    private readonly UPLOAD_DIR = './public/uploads';
    private readonly URL_PREFIX = '/uploads';

    constructor(private readonly configService: ConfigService) {
        this.ensureUploadDirectoryExists();
    }

    /**
     * Core Method: Upload File
     * Menerapkan Adapter Pattern sederhana. 
     * Input: Binary File -> Output: Public URL String
     */
    async uploadFile(file: Express.Multer.File): Promise<{ url: string; filename: string; mimeType: string }> {
        try {
            // 1. Generate Safe Filename (UUID + Extension)
            const fileExt = path.extname(file.originalname).toLowerCase();
            const filename = `${uuidv4()}${fileExt}`;
            const filePath = path.join(this.UPLOAD_DIR, filename);

            // 2. Write File to Disk (Local Strategy)
            // Note: Jika pindah ke S3, ganti blok kode ini dengan s3.upload()
            await fs.promises.writeFile(filePath, file.buffer);

            // 3. Construct Public URL
            // Kita return relative path agar FE bisa append Base URL sendiri, 
            // atau dilayani langsung oleh Nginx/ServeStatic
            const publicUrl = `${this.URL_PREFIX}/${filename}`;

            this.logger.log(`File uploaded successfully: ${filename}`);

            return {
                url: publicUrl,
                filename: filename,
                mimeType: file.mimetype,
            };
        } catch (error) {
            this.logger.error(`Failed to upload file: ${error.message}`);
            throw new InternalServerErrorException('Could not save file to storage.');
        }
    }

    /**
     * Utility: Delete File
     * Penting untuk cleanup jika data di database dihapus (Optional implementation for now)
     */
    async deleteFile(filename: string): Promise<void> {
        try {
            const filePath = path.join(this.UPLOAD_DIR, filename);
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
            }
        } catch (error) {
            this.logger.warn(`Failed to delete file ${filename}: ${error.message}`);
            // Kita suppress error delete agar tidak mengganggu flow bisnis utama
        }
    }

    // --- INTERNAL HELPERS ---

    private ensureUploadDirectoryExists() {
        if (!fs.existsSync(this.UPLOAD_DIR)) {
            fs.mkdirSync(this.UPLOAD_DIR, { recursive: true });
            this.logger.log(`Created upload directory at: ${this.UPLOAD_DIR}`);
        }
    }
}