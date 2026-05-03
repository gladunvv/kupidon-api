import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class CorsConfig {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  allowedOrigins!: string[];
}

export class AppConfig {
  @IsInt()
  @Min(1)
  port!: number;

  @ValidateNested()
  @Type(() => CorsConfig)
  cors!: CorsConfig;
}

export class MongoConfig {
  @IsString()
  uri!: string;
}

export class RedisConfig {
  @IsString()
  url!: string;
}

export class JwtConfig {
  @IsString()
  secret!: string;

  @IsString()
  secret_refresh!: string;

  @IsString()
  accessExpiresIn!: string;

  @IsString()
  refreshExpiresIn!: string;

  @IsInt()
  @Min(1)
  refreshCookieMaxAge!: number;
}

export class OtpConfig {
  @IsInt()
  @Min(60)
  ttlSeconds!: number;

  @IsInt()
  @Min(4)
  length!: number;
}

export class EncryptionConfig {
  @IsString()
  @Matches(/^[0-9a-fA-F]{64}$/)
  key!: string;
}

export class RootConfig {
  @ValidateNested()
  @Type(() => AppConfig)
  app!: AppConfig;

  @ValidateNested()
  @Type(() => MongoConfig)
  mongodb!: MongoConfig;

  @ValidateNested()
  @Type(() => RedisConfig)
  redis!: RedisConfig;

  @ValidateNested()
  @Type(() => JwtConfig)
  jwt!: JwtConfig;

  @ValidateNested()
  @Type(() => OtpConfig)
  otp!: OtpConfig;

  @ValidateNested()
  @Type(() => EncryptionConfig)
  encryption!: EncryptionConfig;
}
