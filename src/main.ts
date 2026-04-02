import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { validationPipe } from './core/pipes/validation.pipe';
import { JwtAuthGuard } from './auth/guards/auth-guard';
import { ResponseInterceptor } from './core/http/response.interceptor';
import { HttpExceptionFilter } from './core/http/http-exception.filter';
import { MulterExceptionFilter } from './core/http/multer-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const ALLOWED_ORIGINS = [
  'http://localhost:5174',
  'http://localhost:5173',
  'http://kupidons.ru',
  'https://kupidons.ru',
  'https://www.kupidons.ru',
];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kupidon API')
    .setDescription('OpenAPI schema for Kupidon backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    jsonDocumentUrl: 'docs-json',
  });

  app.use(cookieParser());
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  app.useGlobalPipes(validationPipe);
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new MulterExceptionFilter(), new HttpExceptionFilter());

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(8000);
}

bootstrap();
