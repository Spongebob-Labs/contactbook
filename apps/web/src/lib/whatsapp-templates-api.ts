import { apiFetch } from "@/lib/api";

export type WhatsappTemplateUseCase = "CARD_SHARE";

export type WhatsappTemplate = {
  id: string;
  key: string;
  useCase: WhatsappTemplateUseCase | string;
  locale: string;
  bodyPreview: string;
  contentSid: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  approvalStatus?:
    | "approved"
    | "pending"
    | "received"
    | "rejected"
    | "unknown"
    | string;
  rejectionReason?: string | null;
};

export async function listWhatsappTemplates(
  useCase?: WhatsappTemplateUseCase,
): Promise<WhatsappTemplate[]> {
  const params = useCase
    ? `?useCase=${encodeURIComponent(useCase)}`
    : "";
  return apiFetch<WhatsappTemplate[]>(`/v1/whatsapp-templates${params}`);
}

export async function getWhatsappTemplate(
  key: string,
): Promise<WhatsappTemplate> {
  return apiFetch<WhatsappTemplate>(
    `/v1/whatsapp-templates/${encodeURIComponent(key)}`,
  );
}

export async function updateWhatsappTemplate(
  key: string,
  body: {
    isActive?: boolean;
    isDefault?: boolean;
    body?: string;
    buttonTitle?: string;
  },
): Promise<WhatsappTemplate> {
  return apiFetch<WhatsappTemplate>(
    `/v1/whatsapp-templates/${encodeURIComponent(key)}`,
    {
      method: "PATCH",
      body,
    },
  );
}

export type CreateWhatsappTemplateInput = {
  key: string;
  body: string;
  buttonTitle?: string;
  category?: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  useCase?: WhatsappTemplateUseCase;
  locale?: string;
  headerImageUrl?: string;
  isDefault?: boolean;
};

export async function createWhatsappTemplate(
  input: CreateWhatsappTemplateInput,
): Promise<WhatsappTemplate> {
  return apiFetch<WhatsappTemplate>("/v1/whatsapp-templates", {
    method: "POST",
    body: {
      key: input.key.trim(),
      body: input.body.trim(),
      ...(input.buttonTitle?.trim()
        ? { buttonTitle: input.buttonTitle.trim() }
        : {}),
      ...(input.category ? { category: input.category } : {}),
      useCase: input.useCase ?? "CARD_SHARE",
      locale: input.locale ?? "en",
      ...(input.headerImageUrl?.trim()
        ? { headerImageUrl: input.headerImageUrl.trim() }
        : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    },
  });
}

export async function deleteWhatsappTemplate(
  key: string,
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(
    `/v1/whatsapp-templates/${encodeURIComponent(key)}`,
    { method: "DELETE" },
  );
}
