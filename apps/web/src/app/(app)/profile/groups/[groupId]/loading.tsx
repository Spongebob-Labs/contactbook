import { GroupEditorSkeleton } from "./group-editor-client";

/**
 * The route-level loading UI for `/profile/groups/[groupId]` (spec §6.1 R-17, §8D.1).
 *
 * §8D.3's loading column for this screen reads *"field-row skeletons"* — the header block
 * at its real rhythm and five row bones in the boxes the rows will occupy, so the content
 * arrives without moving anything.
 *
 * No `data-screen-state` here: that attribute belongs to the client component's root and
 * a second element carrying it turns a strict e2e locator into a phantom failure.
 */
export default function FieldGroupLoading() {
  return <GroupEditorSkeleton />;
}
