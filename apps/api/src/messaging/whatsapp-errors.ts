export const RECIPIENT_INITIATION_REQUIRED = "RECIPIENT_INITIATION_REQUIRED";
export const WHATSAPP_DELIVERY_FAILED = "WHATSAPP_DELIVERY_FAILED";

export class WhatsappProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: {
      providerMessageId?: string;
      providerErrorCode?: string;
    } = {},
  ) {
    super(message);
    this.name = "WhatsappProviderError";
  }
}
