import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { join } from 'path';

// --- Logging & Monitoring Imports ---
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/configs/winston.config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  /**
   * 1. Inisialisasi App dengan NestExpressApplication
   * Generics <NestExpressApplication> diperlukan agar kita bisa mengakses
   * properti spesifik Express jika dibutuhkan di masa depan.
   */
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  const logger = new Logger('Bootstrap');

  /**
   * 2. GLOBAL PREFIX
   * Semua endpoint akan diawali dengan /api (contoh: /api/auth/login).
   */
  app.setGlobalPrefix('api');

  /**
   * 3. Infrastructure: Payload Limits
   * Konfigurasi ini KRUSIAL untuk fitur Upload File.
   * Kita set 50mb (Safe Buffer) untuk menangani request multipart/form-data.
   */
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  /**
   * 4. Konfigurasi CORS (Security)
   * Daftar origin yang diizinkan untuk mengakses API ini.
   */
  app.enableCors({
    origin: [
      'http://localhost:3000',           // Frontend Local
      'https://keuanganku.geocitra.com', // Production Domain
      'http://localhost:8080',           // Docker Internal
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, x-device-id',
    // Expose Headers agar Frontend bisa baca Token MGC dan Filename PDF
    exposedHeaders: ['X-MGC-Token', 'Content-Disposition'],
  });

  /**
   * 5. Global Pipes & Interceptors (Quality Assurance)
   */
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Hapus properti yang tidak ada di DTO
    transform: true, // Otomatis transform tipe data primitive
    forbidNonWhitelisted: false, // Loose mode untuk development awal
  }));

  /**
   * 6. Swagger Documentation
   * Dokumentasi API otomatis yang dapat diakses di /api/docs
   */
  const config = new DocumentBuilder()
    .setTitle('Keuanganku API')
    .setDescription('API Dokumentasi Portal Belajar & Perencanaan Keuangan PAM Jaya')
    .setVersion('1.0')
    .addBearerAuth()
    .addServer('http://localhost:4000', 'Local Development')
    .addServer('https://keuanganku.geocitra.com', 'Production Server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  /**
   * 7. Start Server
   * Note: Static Assets sekarang dilayani oleh ServeStaticModule di app.module.ts
   * Folder: ./uploads -> URL: /api/uploads
   */
  const port = process.env.PORT || 4000;

  // [FIX] Bind ke 0.0.0.0 untuk kompatibilitas Docker/Network
  // Agar bisa diakses dari luar container (misal oleh Frontend container)
  await app.listen(port, '0.0.0.0');

  // [FIX] Gunakan process.cwd() agar path akurat saat mode production/dist
  // Ini memastikan log menunjuk ke folder uploads di root project, bukan di dalam dist
  const uploadPath = join(process.cwd(), 'uploads');

  logger.log(`🚀 Backend Server running on internal port: ${port}`);
  logger.log(`📂 Static Assets Directory (Managed by Module): ${uploadPath}`);
  logger.log(`📄 Swagger Docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();