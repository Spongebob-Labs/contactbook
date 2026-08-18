import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DragHandle,
  EmptyHint,
  Field,
  RepeatableRow,
  SectionIntro,
  newId,
} from "@/components/cards/builder/builder-parts";
import { reorderBlocks } from "@/lib/card-schema";
import type {
  CardBlock,
  CardSnapshot,
  CardSocial,
  CardSocialPlatform,
} from "@/lib/card-schema";

const PLATFORMS: CardSocialPlatform[] = [
  "linkedin",
  "x",
  "instagram",
  "facebook",
  "github",
  "youtube",
  "tiktok",
  "whatsapp",
  "telegram",
];

const PLATFORM_LABEL: Record<CardSocialPlatform, string> = {
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
  facebook: "Facebook",
  github: "GitHub",
  youtube: "YouTube",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

const BLOCK_TYPES: Array<{ value: CardBlock["type"]; label: string }> = [
  { value: "link", label: "Link" },
  { value: "heading", label: "Heading" },
  { value: "text", label: "Text" },
];

function Sortable({
  id,
  children,
}: {
  id: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-90" : undefined}
    >
      {children(<DragHandle {...attributes} {...listeners} />)}
    </div>
  );
}

/**
 * Socials and the free-form block list — the Linktree half of the card.
 *
 * Only blocks are reorderable. Socials render as a fixed icon row in every
 * layout, so their order is not something the user can perceive, and offering a
 * drag handle that changes nothing visible is worse than offering none.
 */
export function LinksSection({
  snapshot,
  onChange,
}: {
  snapshot: CardSnapshot;
  onChange: (next: CardSnapshot) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const setSocials = (socials: CardSocial[]) =>
    onChange({ ...snapshot, socials });
  const setBlocks = (blocks: CardBlock[]) => onChange({ ...snapshot, blocks });

  const patchSocial = (index: number, partial: Partial<CardSocial>) => {
    setSocials(
      snapshot.socials.map((social, i) =>
        i === index ? { ...social, ...partial } : social,
      ),
    );
  };

  const patchBlock = (index: number, partial: Record<string, unknown>) => {
    setBlocks(
      snapshot.blocks.map((block, i) =>
        i === index ? ({ ...block, ...partial } as CardBlock) : block,
      ),
    );
  };

  const changeBlockType = (index: number, type: CardBlock["type"]) => {
    const current = snapshot.blocks[index];
    if (!current || current.type === type) {
      return;
    }
    // Carry the visible flag and id across; the rest of the shape differs per
    // type, so start the new one clean rather than leaving stale keys behind.
    const base = { id: current.id, visible: current.visible };
    const next: CardBlock =
      type === "link"
        ? { ...base, type: "link", label: "", url: "", description: "" }
        : type === "heading"
          ? { ...base, type: "heading", text: "" }
          : { ...base, type: "text", text: "" };
    setBlocks(snapshot.blocks.map((block, i) => (i === index ? next : block)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    setBlocks(
      reorderBlocks(snapshot.blocks, String(active.id), String(over.id)),
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <SectionIntro
          title="Socials"
          hint="Shown as an icon row."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={snapshot.socials.length >= 12}
              onClick={() =>
                setSocials([
                  ...snapshot.socials,
                  {
                    id: newId(),
                    platform: "linkedin",
                    url: "",
                    visible: true,
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add
            </Button>
          }
        />

        {snapshot.socials.length === 0 ? (
          <EmptyHint>No social profiles yet.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-2.5">
            {snapshot.socials.map((social, index) => (
              <RepeatableRow
                key={social.id}
                visible={social.visible}
                onToggleVisible={() =>
                  patchSocial(index, { visible: !social.visible })
                }
                onRemove={() =>
                  setSocials(snapshot.socials.filter((_, i) => i !== index))
                }
              >
                <div className="grid gap-2.5 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <Field label="Platform">
                    <Select
                      value={social.platform}
                      onChange={(event) =>
                        patchSocial(index, {
                          platform: event.target.value as CardSocialPlatform,
                        })
                      }
                    >
                      {PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {PLATFORM_LABEL[platform]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Profile URL">
                    <Input
                      value={social.url}
                      maxLength={500}
                      placeholder="linkedin.com/in/you"
                      onChange={(event) =>
                        patchSocial(index, { url: event.target.value })
                      }
                    />
                  </Field>
                </div>
              </RepeatableRow>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <SectionIntro
          title="Blocks"
          hint="Links, headings and text. Drag to reorder."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={snapshot.blocks.length >= 50}
              onClick={() =>
                setBlocks([
                  ...snapshot.blocks,
                  {
                    id: newId(),
                    type: "link",
                    label: "",
                    url: "",
                    description: "",
                    visible: true,
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add
            </Button>
          }
        />

        {snapshot.blocks.length === 0 ? (
          <EmptyHint>
            No blocks yet. Add a link to a portfolio, booking page or anything
            else worth sharing.
          </EmptyHint>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={snapshot.blocks.map((block) => block.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2.5">
                {snapshot.blocks.map((block, index) => (
                  <Sortable key={block.id} id={block.id}>
                    {(handle) => (
                      <RepeatableRow
                        visible={block.visible}
                        dragHandle={handle}
                        onToggleVisible={() =>
                          patchBlock(index, { visible: !block.visible })
                        }
                        onRemove={() =>
                          setBlocks(
                            snapshot.blocks.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Field label="Type">
                          <Select
                            value={block.type}
                            onChange={(event) =>
                              changeBlockType(
                                index,
                                event.target.value as CardBlock["type"],
                              )
                            }
                          >
                            {BLOCK_TYPES.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        {block.type === "link" ? (
                          <>
                            <div className="grid gap-2.5 sm:grid-cols-2">
                              <Field label="Label">
                                <Input
                                  value={block.label}
                                  maxLength={120}
                                  placeholder="Portfolio"
                                  onChange={(event) =>
                                    patchBlock(index, {
                                      label: event.target.value,
                                    })
                                  }
                                />
                              </Field>
                              <Field label="URL">
                                <Input
                                  value={block.url}
                                  maxLength={500}
                                  placeholder="behance.net/you"
                                  onChange={(event) =>
                                    patchBlock(index, {
                                      url: event.target.value,
                                    })
                                  }
                                />
                              </Field>
                            </div>
                            <Field label="Description" hint="Optional.">
                              <Input
                                value={block.description}
                                maxLength={200}
                                onChange={(event) =>
                                  patchBlock(index, {
                                    description: event.target.value,
                                  })
                                }
                              />
                            </Field>
                          </>
                        ) : (
                          <Field
                            label={block.type === "heading" ? "Heading" : "Text"}
                          >
                            <Input
                              value={block.text}
                              maxLength={block.type === "heading" ? 120 : 600}
                              placeholder={
                                block.type === "heading"
                                  ? "Elsewhere"
                                  : "A short note."
                              }
                              onChange={(event) =>
                                patchBlock(index, { text: event.target.value })
                              }
                            />
                          </Field>
                        )}
                      </RepeatableRow>
                    )}
                  </Sortable>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
