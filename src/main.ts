import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { validationPipe } from './core/pipes/validation.pipe';
import { JwtAuthGuard } from './auth/guards/auth-guard';
import { ResponseInterceptor } from './core/interceptors/response.interceptor';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { MulterExceptionFilter } from './core/filters/multer-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Поддержка cookies
  app.use(cookieParser());

  // Статическая раздача загруженных файлов
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  // Глобальные pipes, guards, interceptors, filters
  app.useGlobalPipes(validationPipe);
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new MulterExceptionFilter(), new HttpExceptionFilter());

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // CORS с поддержкой credentials для cookies

  const allowedOrigins = [
    'http://localhost:5173', // dev
    'http://kupidons.ru', // если пока без HTTPS
    'https://kupidons.ru', // прод с HTTPS
    'https://www.kupidons.ru', // на всякий "www"
  ];

  app.enableCors({
    origin: (origin, cb) => {
      // Запросы без Origin (например, curl/Postman) пропускаем
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // обязательно, если используешь куки/Authorization
  });

  await app.listen(8000);
}

bootstrap();
