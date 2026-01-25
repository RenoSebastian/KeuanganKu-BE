import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// --- ADDED: Imports untuk Logging System ---
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/configs/winston.config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
// -------------------------------------------

async function bootstrap() {
  // 1. Create App dengan Logger Custom (Winston)
  // Kita inject konfigurasi logger di sini agar saat booting pun lognya sudah terekam
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  // 2. Enable CORS
  app.enableCors();

  // 3. Global Registration (Wiring Components)
  // ---------------------------------------------------------
  // A. Pasang "CCTV" (Mencatat semua request masuk & durasinya)
  app.useGlobalInterceptors(new LoggingInterceptor());

  // B. Pasang "Jaring Pengaman" (Menangkap error crash & simpan ke file log)
  app.useGlobalFilters(new AllExceptionsFilter());

  // C. Pasang "Filter Sampah" (Validasi DTO)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  // ---------------------------------------------------------

  // 4. Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('Keuanganku API')
    .setDescription('Dokumentasi API untuk Aplikasi Perencanaan Keuangan PAM JAYA')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 5. Jalankan Server
  const port = process.env.PORT || 4000;
  await app.listen(port);
  
  // Karena logger default sudah diganti Winston, log ini pun akan masuk ke file & console dengan format baru
  // Kita bisa pakai logger instance dari app context jika mau, tapi console.log biasa juga akan ter-intercept
  // atau lebih baik gunakan Logger class dari @nestjs/common untuk konsistensi:
  const logger = new (await import('@nestjs/common')).Logger('Bootstrap');
  logger.log(`🚀 Server berjalan di http://localhost:${port}`);
  logger.log(`📄 Swagger Docs di http://localhost:${port}/api/docs`);
}
bootstrap();