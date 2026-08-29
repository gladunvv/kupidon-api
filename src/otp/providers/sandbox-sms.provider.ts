import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider, SmsSendResult } from './sms-provider.interface';

interface SentMessage {
  phoneNumber: string;
  sentAt: Date;
}

// Default provider until a real one is wired in: "sends" nothing over the
// network, always succeeds, and keeps an in-memory record so dev/tests can
// assert an OTP was dispatched without a real SMS bill. Never logs the
// phone number or message body — same rule OTP abuse protection already
// follows for anything that could end up in production logs.
@Injectable()
export class SandboxSmsProvider implements SmsProvider {
  private readonly logger = new Logger(SandboxSmsProvider.name);
  private readonly sent: SentMessage[] = [];

  async send(phoneNumber: string, _message: string): Promise<SmsSendResult> {
    this.sent.push({ phoneNumber, sentAt: new Date() });
    this.logger.log('Sandbox SMS provider accepted a message for delivery');
    return { success: true, providerMessageId: `sandbox-${this.sent.length}` };
  }

  getSentMessages(): SentMessage[] {
    return [...this.sent];
  }

  reset(): void {
    this.sent.length = 0;
  }
}
