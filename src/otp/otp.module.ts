import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { SMS_PROVIDER } from './providers/sms-provider.interface';
import { SandboxSmsProvider } from './providers/sandbox-sms.provider';
import { RetryingSmsProvider } from './providers/retrying-sms.provider';

@Module({
  imports: [RedisModule],
  providers: [
    OtpService,
    SandboxSmsProvider,
    // Swap this factory for a real provider (Twilio, SMS.ru, ...) when one
    // is configured — everything else in the app depends only on the
    // SmsProvider interface.
    {
      provide: SMS_PROVIDER,
      useFactory: (sandbox: SandboxSmsProvider) =>
        new RetryingSmsProvider(sandbox),
      inject: [SandboxSmsProvider],
    },
  ],
  exports: [OtpService, SandboxSmsProvider],
})
export class OtpModule {}
