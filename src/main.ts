import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { validationPipe } from './core/pipes/validation.pipe';
import { JwtAuthGuard } from './auth/guards/auth-guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(validationPipe);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));
  app.enableCors({
    origin: 'http://localhost:3000',
    methods: 'GET,POST',
    allowedHeaders: 'Content-Type,Authorization',
  });
  await app.listen(8000);
}

bootstrap();
