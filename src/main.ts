import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Enable CORS (Agar Frontend Next.js bisa nembak API ini)
  app.enableCors();

  // 2. Global Validation Pipe (Filter Data Sampah di Pintu Depan)
  // whitelist: true -> properti yang tidak ada di DTO akan dibuang otomatis
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // 3. Setup Swagger (Dokumentasi API Otomatis)
  const config = new DocumentBuilder()
    .setTitle('Keuanganku API')
    .setDescription('Dokumentasi API untuk Aplikasi Perencanaan Keuangan PAM JAYA')
    .setVersion('1.0')
    .addBearerAuth() // Support Login Token di Docs
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // Akses di: localhost:4000/api/docs

  // 4. Jalankan Server
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Server berjalan di http://localhost:${port}`);
  console.log(`📄 Swagger Docs di http://localhost:${port}/api/docs`);
}
bootstrap();