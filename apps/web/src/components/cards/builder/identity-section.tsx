import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SectionIntro } from "@/components/cards/builder/builder-parts";
import { loadCardPhotoFile } from "@/lib/card-maker";
import type { CardSnapshot } from "@/lib/card-schema";
import { initialsFrom } from "@/components/cards/render/card-render-parts";

export function IdentitySection({
  snapshot,
  onChange,
}: {
  snapshot: CardSnapshot;
  onChange: (next: CardSnapshot) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const { identity } = snapshot;

  const patch = (partial: Partial<CardSnapshot["identity"]>) => {
    onChange({ ...snapshot, identity: { ...identity, ...partial } });
  };

  const handlePhoto = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setIsLoadingPhoto(true);
    try {
      patch({ photo: await loadCardPhotoFile(file) });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not read that image.",
      );
    } finally {
      setIsLoadingPhoto(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionIntro
        title="Identity"
        hint="The photo, name and role at the top of every layout."
      />

      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-[18px] font-semibold text-muted-foreground">
          {identity.photo ? (
            <img
              src={identity.photo}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            initialsFrom(identity.displayName)
          )}
        </span>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handlePhoto(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoadingPhoto}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            {isLoadingPhoto
              ? "Reading…"
              : identity.photo
                ? "Replace photo"
                : "Add photo"}
          </Button>
          {identity.photo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => patch({ photo: "" })}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <Field label="Name" htmlFor="identity-name">
        <Input
          id="identity-name"
          value={identity.displayName}
          maxLength={120}
          onChange={(event) => patch({ displayName: event.target.value })}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role" htmlFor="identity-title">
          <Input
            id="identity-title"
            value={identity.title}
            maxLength={160}
            placeholder="Head of Design"
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Field>
        <Field label="Company" htmlFor="identity-company">
          <Input
            id="identity-company"
            value={identity.company}
            maxLength={160}
            placeholder="Shava Studios"
            onChange={(event) => patch({ company: event.target.value })}
          />
        </Field>
      </div>

      <Field
        label="Bio"
        htmlFor="identity-bio"
        hint={`${identity.bio.length}/400`}
      >
        <textarea
          id="identity-bio"
          value={identity.bio}
          maxLength={400}
          rows={3}
          placeholder="One or two lines about what you do."
          onChange={(event) => patch({ bio: event.target.value })}
          className="flex w-full resize-y rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground shadow-sm transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>
    </div>
  );
}
