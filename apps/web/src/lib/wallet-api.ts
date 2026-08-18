import { API_BASE, ApiError, apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session-tokens";

/** Whether the server currently holds a certificate it can sign passes with. */
export async function fetchWalletStatus(): Promise<{ configured: boolean }> {
  return apiFetch<{ configured: boolean }>("/v1/wallet/status");
}

/**
 * Download a signed `.pkpass`.
 *
 * Bypasses `apiFetch` because the response is a binary bundle, not JSON — and
 * because the browser must receive the real content type for iOS to hand the
 * file to Wallet rather than rendering it.
 */
export async function fetchWalletPass(cardId: string): Promise<Blob> {
  const token = getAccessToken();

  const response = await fetch(`${API_BASE}/v1/wallet/cards/${cardId}/pass`, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = "Could not build the Wallet pass.";
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // Non-JSON error body; the default message stands.
    }
    throw new ApiError(message, response.status, null);
  }

  return response.blob();
}
