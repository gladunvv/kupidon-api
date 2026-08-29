export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

// Provider-agnostic contract. A real provider (Twilio, SMS.ru, Vonage, ...)
// implements this and gets wired in OtpModule in place of
// SandboxSmsProvider — nothing else in the app needs to change.
export interface SmsProvider {
  send(phoneNumber: string, message: string): Promise<SmsSendResult>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
