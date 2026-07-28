/**
 * @deprecated Use `@/lib/cards-api` + `@/lib/card-presentation`.
 * Kept as thin re-exports so older imports compile during migration.
 */
export { createCard as createLocalCard, getCard as getLocalCardAsync, listCards as listLocalCardsAsync } from "@/lib/cards-api";

/** Always false — cards are loaded from the API. */
export const USE_LOCAL_CARDS = false;
