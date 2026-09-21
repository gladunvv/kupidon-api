import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// A JWT secret shorter than the HMAC-SHA256 block is the weakest link of
// every session in the system; refuse to start rather than sign with it.
const MIN_JWT_SECRET_LENGTH = 32;

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

  // Number of reverse proxies in front of the API. Leave unset when the API
  // is exposed directly: with it set, a client can forge X-Forwarded-For and
  // get a fresh per-IP OTP budget; without it behind a proxy, every request
  // looks like it comes from the proxy and the per-IP OTP budget is shared
  // by all users.
  @IsOptional()
  @IsInt()
  @Min(1)
  trustProxyHops?: number;

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
  @MinLength(MIN_JWT_SECRET_LENGTH)
  secret!: string;

  @IsString()
  @MinLength(MIN_JWT_SECRET_LENGTH)
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

  @IsOptional()
  @IsInt()
  @Min(1)
  cooldownSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  requestWindowSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRequestsPerWindow?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRequestsPerIpWindow?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxVerifyAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  blockSeconds?: number;
}

export class EncryptionKeyConfig {
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Matches(/^[0-9a-fA-F]{64}$/)
  key!: string;
}

export class EncryptionConfig {
  @IsInt()
  @Min(1)
  currentVersion!: number;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => EncryptionKeyConfig)
  keys!: EncryptionKeyConfig[];
}

export class SentryConfig {
  @IsString()
  dsn!: string;
}

export class MetricsConfig {
  @IsString()
  token!: string;
}

export class StorageConfig {
  @IsString()
  endpoint!: string;

  @IsString()
  region!: string;

  @IsString()
  bucket!: string;

  @IsString()
  accessKeyId!: string;

  @IsString()
  secretAccessKey!: string;

  // Base URL embedded in photo URLs stored in Mongo, e.g.
  // "https://cdn.example.com" or a browser-reachable MinIO endpoint.
  @IsString()
  publicUrl!: string;
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

  @ValidateNested()
  @Type(() => StorageConfig)
  storage!: StorageConfig;

  @IsOptional()
  @ValidateNested()
  @Type(() => SentryConfig)
  sentry?: SentryConfig;

  @IsOptional()
  @ValidateNested()
  @Type(() => MetricsConfig)
  metrics?: MetricsConfig;
}
