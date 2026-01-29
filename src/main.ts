import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express'; // [NEW] Import Express untuk setting limit

// --- ADDED: Imports untuk Logging System ---
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/configs/winston.config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // 1. Create App dengan Logger Custom (Winston)
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  // [FIX] NAIKKAN LIMIT BODY PARSER UNTUK GAMBAR BASE64
  // Default NestJS/Express hanya 100kb, kita naikkan jadi 50mb
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.enableCors();

  // 2. Global Registration
  // A. Pasang "CCTV" (Mencatat request)
  app.useGlobalInterceptors(new LoggingInterceptor());

  // B. Pasang "Jaring Pengaman" (Menangkap error)
  app.useGlobalFilters(new AllExceptionsFilter());

  // C. Validasi
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false, // Set false agar field extra tidak error (flexible)
  }));

  const config = new DocumentBuilder()
    .setTitle('Keuanganku API')
    .setDescription('Dokumentasi API untuk Aplikasi Perencanaan Keuangan PAM JAYA')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  const logger = new (await import('@nestjs/common')).Logger('Bootstrap');
  logger.log(`🚀 Server berjalan di http://localhost:${port}`);
  logger.log(`📄 Swagger Docs di http://localhost:${port}/api/docs`);
}
bootstrap();