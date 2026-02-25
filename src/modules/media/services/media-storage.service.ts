import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises'; // Menggunakan API Promise native
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MediaStorageService implements OnModuleInit {
    private readonly logger = new Logger(MediaStorageService.name);

    // [CONFIGURATION]
    // Menggunakan strategi Local Storage. 
    // Default './uploads', tapi bisa di-override via ENV untuk production (misal: volume docker)
    private readonly UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

    // URL Prefix yang akan disimpan di database.
    // Frontend akan mengakses via: {BASE_URL}/media/{filename}
    // Note: Prefix 'media' harus sesuai dengan controller route
    private readonly URL_PREFIX = 'media';

    /**
     * Lifecycle Hook: Dijalankan otomatis saat modul diinisialisasi.
     * Memastikan folder upload tersedia sebelum ada request masuk.
     */
    onModuleInit() {
        this.ensureUploadDirectoryExists();
    }

    /**
     * Core Method: Upload File
     * Mengubah Binary Buffer dari Request menjadi File Fisik di Server.
     */
    async uploadFile(file: Express.Multer.File, subFolder = 'media'): Promise<{ url: string; path: string; mimeType: string; size: number }> {
        try {
            // 1. Validasi Keberadaan File (Defensive Programming)
            if (!file) {
                throw new InternalServerErrorException('File object is empty.');
            }

            // 2. Siapkan Folder Tujuan (misal uploads/media)
            const targetDir = path.join(this.getUploadPath(), subFolder);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // 3. Generate Safe Filename
            // Format: {UUID-V4}{OriginalExtension}
            const fileExt = path.extname(file.originalname).toLowerCase();
            const filename = `${uuidv4()}${fileExt}`;

            // Resolve absolute path untuk keamanan penulisan
            const filePath = path.join(targetDir, filename);

            // 4. Write File to Disk (Asynchronous I/O)
            await fsPromises.writeFile(filePath, file.buffer);

            this.logger.log(`File persisted successfully: ${filename} (${file.size} bytes)`);

            // 5. Return Metadata
            // URL Publik: /media/{filename} -> Sesuai endpoint controller GET :filename
            // Path Relatif: media/{filename} -> Untuk keperluan delete internal
            const publicUrl = `/${this.URL_PREFIX}/${filename}`;
            const relativePath = `${subFolder}/${filename}`;

            return {
                url: publicUrl,
                path: relativePath,
                mimeType: file.mimetype,
                size: file.size,
            };

        } catch (error: any) {
            this.logger.error(`Failed to save file: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Gagal menyimpan file ke media storage server.');
        }
    }

    /**
     * Utility: Delete File
     * Menghapus file fisik. Penting untuk proses Cleanup/Retention agar server tidak penuh sampah.
     * Return boolean: Agar caller bisa menghitung success/fail rate.
     */
    async deleteFile(relativePath: string): Promise<boolean> {
        if (!relativePath) return false;

        try {
            // [SECURITY] Sanitasi input path untuk mencegah Path Traversal Attack
            // Kita ambil nama filenya saja, lalu gabung ulang dengan folder resmi.
            // Ini mencegah input jahat seperti "../../etc/passwd"

            // Catatan: Jika struktur folder lebih dalam (misal: uploads/2024/10/file.jpg),
            // logika ini perlu disesuaikan. Untuk saat ini kita asumsikan flat structure atau 1 level subfolder.

            // Ambil path absolut
            const absolutePath = path.resolve(this.getUploadPath(), relativePath);

            // Double Check: Pastikan path yang dihasilkan masih di dalam UPLOAD_DIR root
            if (!absolutePath.startsWith(this.getUploadPath())) {
                this.logger.warn(`Security Block: Attempt to delete file outside upload dir: ${absolutePath}`);
                return false;
            }

            // Cek eksistensi file sebelum menghapus
            try {
                await fsPromises.access(absolutePath, fs.constants.F_OK);
                await fsPromises.unlink(absolutePath);

                this.logger.log(`File deleted successfully: ${relativePath}`);
                return true; // Sukses terhapus

            } catch (err: any) {
                if (err.code === 'ENOENT') {
                    // [IDEMPOTENCY]
                    // Jika file tidak ditemukan, kita anggap "Sukses" (karena tujuan akhirnya file tidak ada).
                    // Namun return false agar caller tahu tidak ada aksi penghapusan real yang terjadi (opsional).
                    this.logger.warn(`File not found during cleanup (skipped): ${relativePath}`);
                    return false;
                }
                throw err; // Lempar error lain (misal: Permission Denied) ke catch block luar
            }

        } catch (error: any) {
            this.logger.error(`Cleanup failed for ${relativePath}: ${error.message}`);
            // Kita return false (gagal hapus) tapi TIDAK throw error, 
            // agar proses batch delete pada array file lain tetap berjalan.
            return false;
        }
    }

    /**
     * [PHASE 1: DISCOVERY & INDEXING]
     * Mengembalikan Async Generator untuk iterasi file fisik secara efisien (Streaming).
     * Pattern: Directory Iterator
     * Mengapa? fs.readdir biasa memuat seluruh array nama file ke RAM. 
     * fs.opendir membuka stream pointer ke direktori, sangat hemat memori untuk ribuan file.
     */
    async *getFileIterator(subFolder = 'media'): AsyncGenerator<string> {
        const dirPath = path.join(this.getUploadPath(), subFolder);

        try {
            // Membuka directory stream
            const dir = await fsPromises.opendir(dirPath);

            // Iterasi pointer
            for await (const dirent of dir) {
                // Hanya proses file, abaikan folder
                if (dirent.isFile()) {
                    // Abaikan file sistem (e.g., .gitignore, .DS_Store)
                    if (dirent.name.startsWith('.')) continue;

                    // Yield path relatif
                    yield `${subFolder}/${dirent.name}`;
                }
            }
        } catch (error: any) {
            this.logger.error(`Failed to open directory stream: ${error.message}`);
            // Jika folder tidak ada, kita yield kosong (bukan throw error) agar proses cron tidak crash total
            return;
        }
    }

    /**
     * [PHASE 3 NEW] Get File Metadata
     * Mengambil info ukuran dan waktu modifikasi file untuk keperluan audit & safety check.
     */
    async getFileStats(relativePath: string): Promise<{ size: number; mtime: Date } | null> {
        try {
            const absolutePath = path.resolve(this.getUploadPath(), relativePath);

            // Double security check
            if (!absolutePath.startsWith(this.getUploadPath())) return null;

            // fs.stat memberikan informasi size (bytes) dan mtime (modified time)
            const stats = await fsPromises.stat(absolutePath);
            return {
                size: stats.size,
                mtime: stats.mtime
            };
        } catch (error) {
            // Jika file tidak ada atau error lain, return null
            return null;
        }
    }

    // --- INTERNAL HELPERS ---

    /**
     * Mengembalikan Absolute Path ke folder uploads.
     * Menggunakan process.cwd() untuk memastikan path benar dimanapun node dijalankan.
     */
    private getUploadPath(): string {
        return path.resolve(process.cwd(), this.UPLOAD_DIR);
    }

    private ensureUploadDirectoryExists() {
        const fullPath = this.getUploadPath();
        if (!fs.existsSync(fullPath)) {
            try {
                fs.mkdirSync(fullPath, { recursive: true });
                this.logger.log(`Infrastructure Ready. Upload directory created at: ${fullPath}`);
            } catch (error: any) {
                this.logger.error(`CRITICAL: Failed to create upload directory at ${fullPath}. ${error.message}`);
                throw new Error('Storage infrastructure initialization failed.');
            }
        }
    }
}