import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { cards as cardsApi } from "@/lib/api";
import { toScreenError } from "@/lib/api/errors";
import { loadProfile } from "@/lib/api/loaders";
import type { CardUsage, ProfileData } from "@/app/(app)/profile/profile-client";
import type { FieldGroup, FixtureError } from "@/types/domain";

import { GroupEditorClient, GroupEditorSkeleton } from "./group-editor-client";

/**
 * `/profile/groups/[groupId]` — spec §6.1 R-17, §8D.3, plan T25.
 *
 * ## Three Next 16 facts this file depends on (plan §0.4)
 * - **`params` is a `Promise`** and is awaited. A synchronous read is the single most common way
 *   a page written from memory fails to build in this version.
 * - **`PageProps<'/profile/groups/[groupId]'>` is globally generated and never imported.**
 * - `generateMetadata` receives the same Promise-shaped props and runs for unknown ids too, so it
 *   answers without throwing.
 *
 * ## What changed when the API arrived
 * The id used to be checked against `fixtureGroups` — a fixed set identical in every state, so the
 * check could not disagree with the client half. Now it is checked against **the caller's own
 * groups**, which means the lookup is a real authorisation boundary: another user's group id is
 * simply not in the list and lands on `not-found.tsx`.
 *
 * `generateMetadata` therefore has to fetch too. It shares `loadProfile`'s request-scoped
 * memoisation with the page body, so naming the group costs no extra round trip.
 *
 * ## The soft 404, and why it is correct rather than a compromise
 * `loading.tsx` on this route is a Suspense boundary, so Next flushes the shell before this
 * component's `notFound()` runs and the response is already committed at 200. Next's documented
 * behaviour is then to inject `<meta name="robots" content="noindex">` and render
 * `not-found.tsx`. §11 is explicit that the reader must never meet a raw 404, and the crawler
 * gets the half of the answer that matters to it. Same ruling as R-18 (D11).
 */

/**
 * The group, or `null`.
 *
 * Swallows a failure into `null` on purpose: this runs inside `generateMetadata` too, which must
 * answer without throwing. A transient API error therefore titles the tab "Field group not
 * found" — mildly wrong, and far better than a crash during metadata generation. The page body
 * below distinguishes the two properly.
 */
async function findGroup(groupId: string): Promise<FieldGroup | null> {
  try {
    const { profile } = await loadProfile();
    return profile.groups.find((group) => group.id === groupId) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/profile/groups/[groupId]">): Promise<Metadata> {
  const { groupId } = await params;
  const group = await findGroup(groupId);

  if (group === null) {
    return { title: "Field group not found" };
  }

  return {
    title: `${group.name} · Profile`,
    description: `Reorder, edit and delete the fields in ${group.name}.`,
  };
}

export default async function FieldGroupPage({
  params,
}: PageProps<"/profile/groups/[groupId]">) {
  const { groupId } = await params;

  return (
    <Suspense fallback={<GroupEditorSkeleton />}>
      <GroupEditorLoader groupId={groupId} />
    </Suspense>
  );
}

/**
 * Fetch the profile and the cards that reference its fields.
 *
 * The cards are what make the §11 E-41 delete confirmation true: "3 cards use this field. They
 * will lose it." Reduced to `{ name, fieldIds }` here rather than mapped to full `ContactCard`s,
 * because that is all the consequence line needs and a full map would drag appearance derivation
 * into a screen that draws no card.
 *
 * A cards failure is swallowed to an empty list rather than failing the screen: losing the blast
 * radius makes one sentence less specific, while failing the screen loses the editor entirely.
 * The profile itself is the load-bearing read, and its failure travels as data.
 */
async function GroupEditorLoader({ groupId }: { groupId: string }) {
  let data: ProfileData | null = null;
  let failure: FixtureError | null = null;
  let usage: CardUsage[] = [];

  try {
    const loaded = await loadProfile();
    data = {
      user: loaded.user,
      groups: loaded.profile.groups,
      fields: loaded.profile.fields,
    };

    // Only reached when the group is real, so an unknown id costs no cards request.
    if (data.groups.some((group) => group.id === groupId)) {
      try {
        const list = await cardsApi.listCards();
        usage = list.map((card) => ({
          name: card.name,
          fieldIds: card.fields.map((field) => field.fieldId),
        }));
      } catch {
        usage = [];
      }
    }
  } catch (thrown) {
    failure = toScreenError(thrown);
  }

  // Only a *successful* read can prove an id is unknown. Sending a transient API failure to
  // `not-found.tsx` would tell the owner their group was deleted when the server merely blinked.
  if (data !== null && !data.groups.some((group) => group.id === groupId)) notFound();

  return (
    <GroupEditorClient groupId={groupId} data={data} cards={usage} failure={failure} />
  );
}
