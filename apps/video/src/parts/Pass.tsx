import { CARD, T } from "../theme";
import { Qr } from "./Qr";

export const PASS_W = 420;
export const PASS_H = 625; // the product's own 336:500 ratio, held exactly

/**
 * The wallet pass — the product's real object, rebuilt at film scale.
 *
 * Slot order is the product's and is not free to rearrange: brand chip and portrait on one
 * line, role over name, the detail pairs, then the QR at the foot. Someone handed two of these
 * in the product already knows where to look; the film has to agree with that or it is
 * advertising a layout that does not ship.
 */
export function Pass({ phone }: { phone: string }) {
  return (
    <div
      style={{
        width: PASS_W,
        height: PASS_H,
        borderRadius: 34,
        backgroundImage: CARD,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            background: T.cardChipBg,
            color: T.cardChipInk,
            fontSize: 15,
            letterSpacing: 1.4,
            fontWeight: 600,
            padding: "7px 14px",
            borderRadius: 999,
          }}
        >
          FERNWOOD STUDIO
        </div>
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: "50%",
            background: "linear-gradient(160deg,#e8dcc4,#b9a888)",
            border: `2px solid rgba(255,255,255,0.35)`,
          }}
        />
      </div>

      <div style={{ marginTop: 34 }}>
        <div style={{ color: T.cardInkSoft, fontSize: 15, letterSpacing: 1.5, fontWeight: 600 }}>
          HEAD OF PARTNERSHIPS
        </div>
        <div
          style={{
            color: T.cardInk,
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: -1,
            marginTop: 6,
            whiteSpace: "nowrap",
          }}
        >
          Priyanka Raghunathan
        </div>
      </div>

      <Pair label="WORK MOBILE" value={phone} />
      <Pair label="LINK" value="contactbook.app/c/prya-hq" mono />

      <div style={{ marginTop: "auto", display: "flex", justifyContent: "center" }}>
        <Qr text="https://contactbook.app/c/prya-hq" size={224} />
      </div>
    </div>
  );
}

function Pair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ color: T.cardInkSoft, fontSize: 13, letterSpacing: 1.4, fontWeight: 600 }}>
        {label}
      </div>
      <div
        style={{
          color: T.cardInk,
          fontSize: 21,
          fontWeight: 500,
          marginTop: 3,
          fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}
