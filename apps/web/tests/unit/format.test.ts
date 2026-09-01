import { describe, expect, it } from "vitest";

import type { AddressDetail } from "@/types/domain";
import {
  clampText,
  formatAddressLines,
  formatAddressOneLine,
  formatEmailDisplay,
  formatLongDate,
  formatPhoneDisplay,
  formatSocialDisplay,
  formatUrlDisplay,
  initialsFor,
  mailtoHref,
  mapsHref,
  MASK_RUN,
  maskTail,
  parseSocialLink,
  telHref,
  toE164,
  URL_DISPLAY_MAX,
  whatsappHref,
} from "@/lib/format";

/**
 * The display rules of spec §6.6, pinned one row at a time.
 *
 * These functions are the only place a value is turned into something a human reads, so a
 * regression here is invisible in a screenshot and loud in a `.vcf`. Pure functions, no
 * React, no DOM — every case below is decided by a string comparison.
 */

const HOME: AddressDetail = {
  kind: "ADDRESS",
  line1: "Flat 12, Sunder Nagar",
  line2: "Off Carter Road",
  city: "Mumbai",
  region: "Maharashtra",
  postalCode: "400050",
  country: "India",
};

const MINIMAL: AddressDetail = {
  kind: "ADDRESS",
  line1: "221B Baker Street",
  line2: null,
  city: "London",
  region: null,
  postalCode: null,
  country: "United Kingdom",
};

describe("clampText", () => {
  it("leaves a string shorter than the limit untouched", () => {
    expect(clampText("Fernwood Studio", 34)).toBe("Fernwood Studio");
  });

  it("never returns more characters than the limit, ellipsis included", () => {
    const clamped = clampText("x".repeat(80), 34);
    expect(clamped).toHaveLength(34);
    expect(clamped.endsWith("…")).toBe(true);
  });

  it("keeps a string that is exactly the limit", () => {
    const exact = "y".repeat(34);
    expect(clampText(exact, 34)).toBe(exact);
  });
});

describe("toE164 (spec §6.6 PHONE/LANDLINE/FAX)", () => {
  it("strips the punctuation a human types and keeps the leading plus", () => {
    expect(toE164("+91 98201-15577")).toBe("+919820115577");
    expect(toE164("+1 (415) 555 0132")).toBe("+14155550132");
  });

  it("keeps a plus-less number plus-less rather than guessing a country", () => {
    expect(toE164("9820115577")).toBe("9820115577");
  });
});

describe("formatPhoneDisplay", () => {
  it("groups an Indian mobile as +91 XXXXX XXXXX", () => {
    expect(formatPhoneDisplay("+919820115577")).toBe("+91 98201 15577");
  });

  it("groups a North American number as +1 XXX XXX XXXX", () => {
    expect(formatPhoneDisplay("+14155550132")).toBe("+1 415 555 0132");
  });

  it("normalises before grouping, so a messy value still displays cleanly", () => {
    expect(formatPhoneDisplay("+91 98201-15577")).toBe("+91 98201 15577");
  });

  it("returns the E.164 untouched when no dialling plan matches — never a wrong grouping", () => {
    expect(formatPhoneDisplay("+37112345678")).toBe("+37112345678");
  });

  it("returns the E.164 untouched when the digit count contradicts the plan", () => {
    expect(formatPhoneDisplay("+919820")).toBe("+919820");
  });
});

describe("hrefs (spec §6.6, §6.9)", () => {
  it("builds a tel: href from the normalised E.164, not from the display form", () => {
    expect(telHref("+91 98201 15577")).toBe("tel:+919820115577");
  });

  it("builds a mailto: href and lowercases the address", () => {
    expect(mailtoHref("Priyanka@Fernwood.Example")).toBe("mailto:priyanka@fernwood.example");
  });

  it("builds a wa.me href with the plus stripped (§6.9)", () => {
    expect(whatsappHref("+919820115577")).toBe("https://wa.me/919820115577");
  });

  it("lowercases an email for display but leaves it otherwise as entered", () => {
    expect(formatEmailDisplay("Priyanka@Fernwood.Example")).toBe("priyanka@fernwood.example");
  });
});

describe("formatUrlDisplay (spec §6.6 URL)", () => {
  it("strips the protocol and the trailing slash", () => {
    expect(formatUrlDisplay("https://fernwood.example/")).toBe("fernwood.example");
  });

  it("keeps the path", () => {
    expect(formatUrlDisplay("https://fernwood.example/press")).toBe("fernwood.example/press");
  });

  it("clamps to 34 characters", () => {
    const long = "https://fernwood.example/press/2026-partnerships-overview";
    const display = formatUrlDisplay(long);
    expect(display.length).toBeLessThanOrEqual(URL_DISPLAY_MAX);
    expect(display.startsWith("fernwood.example/press")).toBe(true);
    expect(display.endsWith("…")).toBe(true);
  });

  it("falls back to the clamped raw string when the value is not a parseable URL (E-23)", () => {
    expect(formatUrlDisplay("not a url at all")).toBe("not a url at all");
  });
});

describe("parseSocialLink (spec §6.6 SOCIAL_LINK)", () => {
  it("derives the platform name from the hostname", () => {
    expect(parseSocialLink("https://www.linkedin.com/in/priyanka").platform).toBe("LinkedIn");
    expect(parseSocialLink("https://x.com/prya_builds").platform).toBe("X");
    expect(parseSocialLink("https://github.com/prya").platform).toBe("GitHub");
  });

  it("derives an @handle when the path carries one", () => {
    expect(parseSocialLink("https://x.com/prya_builds").handle).toBe("@prya_builds");
    expect(parseSocialLink("https://www.linkedin.com/in/priyanka").handle).toBe("@priyanka");
    expect(parseSocialLink("https://mastodon.example/@prya").handle).toBe("@prya");
  });

  it("has no handle when the URL is a bare hostname", () => {
    expect(parseSocialLink("https://x.com/").handle).toBeNull();
  });

  it("falls back to the hostname for an unrecognised platform (E-23) and never throws", () => {
    const parsed = parseSocialLink("https://mastodon.example/@prya");
    expect(parsed.platform).toBe("mastodon.example");
    expect(() => parseSocialLink("::::")).not.toThrow();
    expect(parseSocialLink("::::").platform).toBe("::::");
  });

  it("displays the handle when parseable and the platform otherwise", () => {
    expect(formatSocialDisplay("https://x.com/prya_builds")).toBe("@prya_builds");
    expect(formatSocialDisplay("https://x.com/")).toBe("X");
  });
});

describe("formatAddressLines (spec §6.6 ADDRESS)", () => {
  it("composes a full address to exactly two lines", () => {
    expect(formatAddressLines(HOME)).toEqual([
      "Flat 12, Sunder Nagar, Off Carter Road",
      "Mumbai, Maharashtra, 400050, India",
    ]);
  });

  it("drops the null components rather than leaving empty segments", () => {
    expect(formatAddressLines(MINIMAL)).toEqual(["221B Baker Street", "London, United Kingdom"]);
  });

  it("never returns more than two lines", () => {
    expect(formatAddressLines(HOME).length).toBeLessThanOrEqual(2);
  });

  it("composes a single line for the vCard and the maps deep link", () => {
    expect(formatAddressOneLine(MINIMAL)).toBe("221B Baker Street, London, United Kingdom");
    expect(mapsHref(MINIMAL)).toBe(
      "https://www.google.com/maps/search/?api=1&query=221B%20Baker%20Street%2C%20London%2C%20United%20Kingdom",
    );
  });
});

describe("formatLongDate (spec §6.6 DATE)", () => {
  it("renders an en-GB long date", () => {
    expect(formatLongDate("1991-03-08")).toBe("8 March 1991");
  });

  it("is timezone-independent — a date-only value never slips a day", () => {
    expect(formatLongDate("2026-01-01")).toBe("1 January 2026");
    expect(formatLongDate("2026-12-31")).toBe("31 December 2026");
  });

  it("returns the raw value rather than 'Invalid Date' when it cannot parse", () => {
    expect(formatLongDate("sometime in March")).toBe("sometime in March");
  });
});

describe("maskTail — financial masking (spec §6.6, §7.3, AC-33)", () => {
  it("shows the last four characters and replaces the rest with a single run", () => {
    expect(maskTail("50100412345678")).toBe(`${MASK_RUN}5678`);
    expect(maskTail("0x8f2A55949038A501f5B7C0e1B4d8b9C3A2e4d612")).toBe(`${MASK_RUN}d612`);
  });

  it("masks a short value entirely rather than revealing all of it", () => {
    expect(maskTail("1234")).toBe(MASK_RUN);
    expect(maskTail("12")).toBe(MASK_RUN);
    expect(maskTail("")).toBe(MASK_RUN);
  });

  it("never leaks the length of the secret", () => {
    expect(maskTail("50100412345678")).toHaveLength(MASK_RUN.length + 4);
    expect(maskTail("501004123456789012345")).toHaveLength(MASK_RUN.length + 4);
  });
});

describe("initialsFor (spec §5.3a monogram, E-19)", () => {
  it("takes one character from each name", () => {
    expect(initialsFor("Priyanka", "Raghunathan")).toBe("PR");
  });

  it("falls back to a single initial when a name is missing", () => {
    expect(initialsFor("Priyanka", "")).toBe("P");
    expect(initialsFor("", "Raghunathan")).toBe("R");
  });

  it("never returns more than two characters", () => {
    expect(initialsFor("Priyanka Devi", "Raghunathan-Venkataraghavan").length).toBeLessThanOrEqual(2);
  });

  it("returns an empty string rather than throwing on an empty name", () => {
    expect(initialsFor("", "")).toBe("");
  });
});
