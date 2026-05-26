import type { ContactCard } from "@prisma/client";
import type { ConnectionCardOption } from "./connection-flow.types";

export function buildCardOptions(cards: ContactCard[]): ConnectionCardOption[] {
  return cards.map((c, i) => ({
    id: c.id,
    name: c.name,
    index: i + 1,
  }));
}

export function formatCardSelectionMessage(
  prompt: string,
  options: ConnectionCardOption[],
): string {
  const lines = options.map((o) => `${o.index}. ${o.name}`);
  return `${prompt}\n\n${lines.join("\n")}\n\nReply with the number or card name.`;
}

export function resolveCardIdFromInbound(
  text: string,
  options: ConnectionCardOption[],
): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const byUuid = options.find(
    (o) => o.id.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byUuid) {
    return byUuid.id;
  }

  const num = /^(\d+)$/.exec(trimmed);
  if (num) {
    const idx = Number(num[1]);
    const match = options.find((o) => o.index === idx);
    if (match) {
      return match.id;
    }
  }

  const lower = trimmed.toLowerCase();
  const byName = options.filter((o) => o.name.toLowerCase() === lower);
  if (byName.length === 1) {
    return byName[0].id;
  }

  return null;
}
