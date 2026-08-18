import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  EmptyHint,
  Field,
  RepeatableRow,
  SectionIntro,
  newId,
} from "@/components/cards/builder/builder-parts";
import type {
  CardContactMethod,
  CardContactType,
  CardSnapshot,
} from "@/lib/card-schema";

const TYPE_OPTIONS: Array<{ value: CardContactType; label: string }> = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
  { value: "address", label: "Address" },
];

const PLACEHOLDERS: Record<CardContactType, string> = {
  phone: "+971 50 123 4567",
  email: "you@company.com",
  website: "company.com",
  address: "Level 4, 12 Marina Walk, Dubai",
};

/**
 * Structured contact details.
 *
 * These are typed rather than free-form links because they are what the vCard
 * export and the Wallet pass read from. A phone number added here becomes a
 * real `TEL` entry when somebody saves the card; the same number pasted into a
 * custom link block would not.
 */
export function ContactSection({
  snapshot,
  onChange,
}: {
  snapshot: CardSnapshot;
  onChange: (next: CardSnapshot) => void;
}) {
  const setContact = (contact: CardContactMethod[]) => {
    onChange({ ...snapshot, contact });
  };

  const patchAt = (index: number, partial: Partial<CardContactMethod>) => {
    setContact(
      snapshot.contact.map((method, i) =>
        i === index ? { ...method, ...partial } : method,
      ),
    );
  };

  const add = () => {
    setContact([
      ...snapshot.contact,
      { id: newId(), type: "phone", label: "", value: "", visible: true },
    ]);
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionIntro
        title="Contact details"
        hint="These drive the saved contact file and the Wallet pass."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={add}
            disabled={snapshot.contact.length >= 20}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        }
      />

      {snapshot.contact.length === 0 ? (
        <EmptyHint>
          No contact details yet. Add a phone number or email so people can
          reach you.
        </EmptyHint>
      ) : (
        <div className="flex flex-col gap-2.5">
          {snapshot.contact.map((method, index) => (
            <RepeatableRow
              key={method.id}
              visible={method.visible}
              onToggleVisible={() => patchAt(index, { visible: !method.visible })}
              onRemove={() =>
                setContact(snapshot.contact.filter((_, i) => i !== index))
              }
            >
              <div className="grid gap-2.5 sm:grid-cols-[130px_minmax(0,1fr)]">
                <Field label="Type">
                  <Select
                    value={method.type}
                    onChange={(event) =>
                      patchAt(index, {
                        type: event.target.value as CardContactType,
                      })
                    }
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Value">
                  <Input
                    value={method.value}
                    maxLength={400}
                    placeholder={PLACEHOLDERS[method.type]}
                    onChange={(event) =>
                      patchAt(index, { value: event.target.value })
                    }
                  />
                </Field>
              </div>
              <Field
                label="Label"
                hint="Optional. Shown instead of the default wording."
              >
                <Input
                  value={method.label}
                  maxLength={60}
                  placeholder="Work"
                  onChange={(event) =>
                    patchAt(index, { label: event.target.value })
                  }
                />
              </Field>
            </RepeatableRow>
          ))}
        </div>
      )}
    </div>
  );
}
