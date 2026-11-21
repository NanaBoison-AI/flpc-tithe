export interface SmsSendResult {
  ok: boolean;
  providerMessageId?: string;
  response: unknown; // raw provider response (no secrets)
  error?: string;
}
export interface SmsProvider {
  send(input: { to: string; message: string; senderId: string }): Promise<SmsSendResult>;
  balance(): Promise<{ balance: number; bonus?: number }>;
}
