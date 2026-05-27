export type ConnectionCardOption = {
  id: string;
  name: string;
  index: number;
};

export type WhatsappSessionCardMetadata = {
  cardOptions: ConnectionCardOption[];
};

export const CONNECTION_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function connectionSessionExpiresAt(): Date {
  return new Date(Date.now() + CONNECTION_SESSION_TTL_MS);
}
