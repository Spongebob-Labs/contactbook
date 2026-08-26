# The handover film — AI video prompts

Prompts for generating the live-action plates of the Contact Book handover film on Sora / Veo /
Kling / Runway, and how they meet the Remotion pass already in `src/parts/Pass.tsx`.

---

## ⚠ Read this before you generate anything

**Do not ask an AI video model to draw the phone screen.** Not the card, not the QR, not the
contact sheet. Two reasons, and the second is the one that matters:

1. Every model on the market renders UI as illegible mush — warped type, invented icons, a QR
   that is grey noise in the shape of a square. It cannot be prompted away.
2. **A QR that does not scan is the exact detail that tells a viewer the product is a mockup.**
   `src/parts/Qr.tsx` already draws a *real* symbol encoding the *real* card URL, as SVG rects
   on integer module coordinates — because a soft-edged QR is one decoders start refusing at an
   angle. Throwing that away for a hallucinated square would undo the most convincing frame in
   the film.

So the shots below are written to **generate the screen dark, blown out, or angled away**, and
every prompt says so. The screen content is composited afterwards from Remotion — recipe at the
foot of this file.

---

## How to use

1. Paste the **STYLE BLOCK** at the top of every single generation. It is what keeps eight
   separate clips looking like one film.
2. Lock the cast with a reference image (Runway Gen-4 References, Kling face reference, Sora
   cameo). Wording alone will not hold two faces across eight shots — this is the single biggest
   quality lever and no prompt can substitute for it.
3. Generate each shot 4–6 times and keep the best. Expect a ~1-in-4 hit rate on the hand shots.
4. Cut, then composite the screens.

---

## STYLE BLOCK — prepend to every shot

> Cinematic live-action, shot on an ARRI Alexa with vintage spherical primes, shallow depth of
> field, gentle natural film grain, subtle anamorphic-style falloff at the frame edges. Colour
> grade: warm neutral highlights, cool desaturated shadows, muted skin tones, no crushed blacks,
> no orange-and-teal. Lighting is soft, large-source daylight from tall windows with a quiet
> practical fill; late afternoon. Location: a calm contemporary office lounge — pale oak, brushed
> steel, matte concrete, one large plant, glass partitions, no clutter, no visible branding or
> signage anywhere. Handheld with almost no movement — the weight of a real operator, not a
> stabiliser and not a drone. Unhurried, observational, documentary register. Everything reads
> expensive and understated. 24fps, natural motion blur.

---

## CAST BLOCK — paste under the style block

> PERSON A (the sender): early thirties, short dark hair, charcoal fine-wool blazer over an
> ivory merino crew neck, no tie, a thin silver watch, one plain band ring. Calm, low-key
> confidence.
>
> PERSON B (the receiver): late thirties, hair worn back, deep navy overshirt over a soft grey
> tee, minimal round tortoiseshell glasses, no jewellery. Attentive, warm, unhurried.
>
> Both hold matte black slab smartphones with no visible logo or branding.

Swap the descriptions to whoever you actually want on screen — but change them in *every* shot
at once, and re-lock the reference image when you do.

---

## The shots

Each is a separate generation, 5–8 seconds. Shot numbers are the cut order.

### 1 — Establishing · the meeting (6s)

> Wide two-shot. PERSON A and PERSON B stand facing each other beside a tall window in an office
> lounge, mid-conversation, relaxed. PERSON B says something brief, PERSON A nods and smiles
> slightly. They shake hands once, unhurried, and the handshake releases. Camera is static at
> chest height, slight handheld float, 35mm. Backlit by the window so both read as soft
> silhouettes with a warm rim on their shoulders. No phones visible in this shot.

### 2 — The reach (5s)

> Medium close on PERSON A from the chest up, three-quarter angle. PERSON A reaches into the
> inside pocket of their blazer and draws out a matte black smartphone in one smooth,
> unrehearsed motion, bringing it to waist height. Their eyes stay on PERSON B, not on the phone.
> 50mm, shallow focus holding PERSON A's face, background softly dissolved. The phone screen is
> completely black and off.

### 3 — The double-press (5s) · **screen kept dark on purpose**

> Extreme close-up macro on a hand holding a matte black smartphone, side of the device toward
> camera. The thumb presses the side button twice in quick succession — two small, distinct,
> precise movements. On the second press a soft cool light blooms up from the screen and falls
> across the fingers and the cuff of a charcoal blazer. 100mm macro, razor-thin depth of field
> on the thumb and the button, everything beyond it dissolved. **The screen itself is angled away
> from camera and fully blown out to white — no interface, no text, no icons, no image of any
> kind on the screen.** Shallow, tactile, jewellery-advert precision.

### 4 — The card is offered (6s) · **composite plate**

> Over-the-shoulder from behind PERSON A, looking past their shoulder toward PERSON B. PERSON A
> raises the smartphone and turns it to face PERSON B, holding it steady at chest height, screen
> toward the other person. PERSON B's eyes drop to the screen with quiet interest. 40mm, focus on
> the phone with PERSON B soft behind it. **The phone screen is a clean, evenly lit, featureless
> white rectangle — absolutely no interface, no text, no code, no card, no graphics.** Held very
> still for the full duration.

Frame it so the phone stays inside the frame and does not rotate — that is what makes the screen
replacement trivial in post. **Hold the phone still.** Every degree of wobble is a corner track
you have to do by hand later.

### 5 — The scan (6s) · **two-phone hero, composite plate**

> Medium close, side-on profile of both people. PERSON B lifts their own matte black smartphone
> and holds it a hand's width in front of PERSON A's phone, framing it, the way you photograph a
> ticket. Both hands are steady. A moment of stillness, then PERSON B's shoulders relax very
> slightly — it worked. 65mm, focus on the two devices, both faces soft. **Both screens are plain
> blown-out white rectangles with no interface, no text and no imagery whatsoever.** Warm window
> light rakes across the metal edges of both phones.

This is the money shot. Generate this one twice as many times as the others.

### 6 — It landed (5s) · **composite plate**

> Close on PERSON B, from just over their phone. Their eyes move down the screen, reading. A
> small, genuine, closed-mouth smile. They give one short nod of acknowledgement and look back up
> at PERSON A. 85mm, very shallow, catchlight from the window in their eyes. **Their phone screen
> is a plain white rectangle with no interface, no text and no imagery.**

### 7 — Back to the conversation (6s)

> Wide two-shot, matching shot 1. Both people lower their phones, PERSON A slips theirs back into
> the blazer pocket, and they resume talking as if nothing notable happened. Camera drifts
> backwards very slowly, letting the window light bloom into the frame. 35mm. Ends on the two of
> them in easy conversation, small in a calm room. No phones visible by the last second.

The point of this shot is that the exchange was *unremarkable* — that is the product claim. Do
not let the model give you a triumphant look-to-camera.

### 8 — Optional beauty plate for the end card (5s)

> Macro tabletop. A matte black smartphone lies face up on a slab of dark honed stone, alone. A
> single soft window light rakes across it from the left, catching the chamfered edge. The camera
> drifts a few centimetres over the device, extremely slow. **The screen is off and perfectly
> black — no interface, no text, no reflection of a person.** Dust motes in the light. Deep
> shadow, high contrast, product-photography stillness.

Composite the pass onto this and it is your end card.

---

## NEGATIVE PROMPT — paste into every generation

> text, letters, numbers, words, watermark, subtitles, captions, logos, brand names, user
> interface, app icons, QR code, screen content, glowing screen graphics, distorted hands, extra
> fingers, merged fingers, six fingers, warped face, plastic skin, waxy skin, beauty retouching,
> oversaturated colour, orange and teal grade, HDR halo, fisheye, drone shot, whip pan, zoom
> punch, slow-motion, stock-footage smiling at camera, thumbs up, high-five, crowded open-plan
> office, cluttered desk, neon, lens flare streaks, vertical video, cartoon, 3d render, anime

---

## Audio (Veo 3 and anything else that generates sound)

> Ambient only. Quiet room tone, a distant muffled hum of a building, faint footsteps somewhere
> off-frame. One soft, dry haptic tick on the second button press. No music, no dialogue, no
> whoosh, no riser, no notification chime.

**No dialogue.** Generated lip-sync at this length is uncanny and it will cost you the "real"
you are asking for. Score it in the edit instead — a single sustained piano or felt-pad note
under the whole thing, letting the haptic tick land in silence.

---

## Platform notes

| Platform | Where it helps | Watch for |
|---|---|---|
| **Veo 3** | Best physical realism on hands and cloth; native ambient audio | Verbose prompts drift — keep the style block, trim the shot to two sentences if it ignores you |
| **Runway Gen-4** | **References** hold a face across shots better than anything else — use it to lock the cast | Weaker on macro detail; use it for 1, 2, 7 and generate the macros elsewhere |
| **Kling 2.x** | Excellent slow, weighty camera moves and skin texture | Loves to add motion — say "camera static" twice if you must |
| **Sora** | Strongest at "a room that feels real"; good on light | Will invent signage and UI unprompted; the negative prompt is not optional here |
| **Luma / Pika** | Fast iteration for finding a frame you like | Treat as previz, regenerate the keeper on one of the above |

Avoid naming **Apple**, **iPhone**, or **Apple Wallet** in any prompt. Most platforms either
refuse the generation or produce a warped counterfeit logo, and either way you cannot ship it.
"Matte black slab smartphone, no visible branding" gets you the shot; the device reads as what it
reads as.

---

## The composite — where the real card goes

The whole film is built so this step is easy. Shots 4, 5, 6 and 8 hand you a phone with a clean
white rectangle where the screen is.

1. **Render the pass from Remotion.** `src/parts/Pass.tsx` is the product's real object at film
   scale — 336:500 held exactly, slot order matching what ships, and `Qr.tsx` encoding the actual
   card URL. Render it on a transparent or black background at the size you need.
2. **Corner-pin it onto the screen** in After Effects (Mocha planar track) or DaVinci Resolve
   (Fusion planar tracker). A still phone tracks in about a minute; a moving one does not, which
   is why the prompts say *hold it still*.
3. **Sell it:** add a soft screen-glow spill onto the fingers and the face, a faint reflection
   layer, and grade the composited screen back to match the plate's contrast. An untouched,
   perfectly clean screen is the giveaway.
4. **Do not scale the QR down past the point it decodes.** Test the finished frame with a real
   phone — if the exported video's QR scans off a monitor, you have a shot no competitor's
   mockup can match, and it is worth building the frame around.

---

## If you only want one generation

> [STYLE BLOCK] [CAST BLOCK] Two professionals stand talking beside a tall window in a calm
> contemporary office lounge, late afternoon. PERSON A draws a matte black smartphone from their
> blazer pocket, presses the side button twice, and turns the phone to face PERSON B. PERSON B
> lifts their own phone and holds it in front of PERSON A's for a moment, then lowers it, reads,
> and nods once with a small genuine smile. Both pocket their phones and resume the conversation.
> Static handheld wide, 35mm, soft backlight, unhurried and observational. **Every phone screen is
> a plain blown-out white rectangle with no interface, no text and no imagery.** [NEGATIVE PROMPT]

Expect to fight it for the beat timing. The shot list is the better path.
