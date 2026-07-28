import type { ProfileMeResponse } from "@/lib/types";

export type MappableFinancialField = {
  fieldId: string;
  label: string;
  kind: "bank" | "wallet" | "crypto";
  isSensitive: boolean;
};

/** Profile fields that expose `fieldId` today (financial rows only). */
export function listMappableFinancialFields(
  profile: ProfileMeResponse | null | undefined,
): MappableFinancialField[] {
  if (!profile?.financial) {
    return [];
  }

  const items: MappableFinancialField[] = [];

  for (const row of profile.financial.bankAccounts ?? []) {
    if (!row.fieldId) continue;
    items.push({
      fieldId: row.fieldId,
      label: `${row.tag || "Bank"} · ${row.bankName || "Account"}`,
      kind: "bank",
      isSensitive: row.isSensitive,
    });
  }

  for (const row of profile.financial.digitalWallets ?? []) {
    if (!row.fieldId) continue;
    items.push({
      fieldId: row.fieldId,
      label: `${row.tag || "Wallet"} · ${row.platform}`,
      kind: "wallet",
      isSensitive: row.isSensitive,
    });
  }

  for (const row of profile.financial.cryptoWallets ?? []) {
    if (!row.fieldId) continue;
    items.push({
      fieldId: row.fieldId,
      label: `${row.tag || "Crypto"} · ${row.network}`,
      kind: "crypto",
      isSensitive: row.isSensitive,
    });
  }

  return items;
}
