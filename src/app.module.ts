import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { MatchModule } from './match/match.module';
import { DialogModule } from './dialog/dialog.module';
import { UploadModule } from './upload/upload.module';
import { ReferenceModule } from './reference/reference.module';

import { RedisModule } from '@liaoliaots/nestjs-redis';
import { LikeMongoModule } from './match/schemas/like.schema';
import { MatchMongoModule } from './match/schemas/match.schema';
import { DialogMongoModule } from './dialog/schemas/dialog.schema';
import { MessageMongoModule } from './dialog/schemas/message.schema';
import { EncryptionModule } from './encryption/encryption.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/load-yaml.config';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      skipProcessEnv: true,
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('mongodb.uri'),
      }),
    }),
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        config: {
          url: configService.getOrThrow<string>('redis.url'),
        },
      }),
    }),
    AuthModule,
    UsersModule,
    DialogModule,
    MatchModule,
    UploadModule,
    ReferenceModule,
    LikeMongoModule,
    MatchMongoModule,
    DialogMongoModule,
    MessageMongoModule,
    EncryptionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
