import { Logger } from '@nestjs/common';
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
import { ConfigService } from '@nestjs/config';
import { ShutdownService } from './health/shutdown.service';
import { StructuredLoggerService } from './core/logging/structured-logger.service';
import { initSentry } from './observability/sentry';

// Time to let the orchestrator notice the readiness flip (via the next
// /health/ready probe) and stop routing new traffic before the HTTP server
// actually stops accepting connections.
const SHUTDOWN_GRACE_PERIOD_MS = 5000;
// Safety net in case app.close() hangs (e.g. a keep-alive connection that
// never goes idle) so the process still exits instead of running forever.
const SHUTDOWN_HARD_TIMEOUT_MS = 15000;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new StructuredLoggerService(),
  });
  const configService = app.get(ConfigService);
  initSentry(configService.get<string>('sentry.dsn'));

  // Publishing the full route/DTO surface is a reconnaissance aid in
  // production; keep it available everywhere else (dev, staging, CI).
  if (process.env.NODE_ENV !== 'production') {
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
  }

  app.use(cookieParser());
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  app.useGlobalPipes(validationPipe);
  app.useGlobalFilters(new MulterExceptionFilter(), new HttpExceptionFilter());
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  app.useGlobalGuards(new JwtAuthGuard(reflector));
  const allowedOrigins = configService.getOrThrow<string[]>(
    'app.cors.allowedOrigins',
  );

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(configService.getOrThrow<number>('app.port'));

  const logger = new Logger('Bootstrap');
  const shutdownService = app.get(ShutdownService);
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.log(`Received ${signal}, starting graceful shutdown`);
    shutdownService.beginShutdown();

    const hardTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_GRACE_PERIOD_MS + SHUTDOWN_HARD_TIMEOUT_MS);
    hardTimeout.unref();

    await new Promise((resolve) =>
      setTimeout(resolve, SHUTDOWN_GRACE_PERIOD_MS),
    );

    await app.close();
    logger.log('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap();
