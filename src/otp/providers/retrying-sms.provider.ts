import { Logger } from '@nestjs/common';
import { SmsProvider, SmsSendResult } from './sms-provider.interface';

export interface RetryOptions {
  maxAttempts: number;
  backoffMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = { maxAttempts: 3, backoffMs: 200 };

// Wraps any SmsProvider with bounded retries on delivery failure. Retrying
// is the provider's job to report (send() returning success: false), not
// something callers should have to reimplement per provider.
export class RetryingSmsProvider implements SmsProvider {
  private readonly logger = new Logger(RetryingSmsProvider.name);

  constructor(
    private readonly delegate: SmsProvider,
    private readonly options: RetryOptions = DEFAULT_OPTIONS,
  ) {}

  async send(phoneNumber: string, message: string): Promise<SmsSendResult> {
    let lastResult: SmsSendResult = { success: false, error: 'not attempted' };

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt += 1) {
      lastResult = await this.delegate.send(phoneNumber, message);
      if (lastResult.success) {
        return lastResult;
      }

      this.logger.warn(
        `SMS send attempt ${attempt}/${this.options.maxAttempts} failed: ${lastResult.error ?? 'unknown error'}`,
      );

      if (attempt < this.options.maxAttempts) {
        await this.sleep(this.options.backoffMs * attempt);
      }
    }

    return lastResult;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
