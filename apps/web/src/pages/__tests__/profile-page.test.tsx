/**
 * Profile page: one scrolling page of editable sections, no tabs.
 *
 * The Personal / Work / Business tab bar mirrored the API's group categories
 * rather than anything a user wants to do — Work duplicated the Personal tab's
 * Work section, and both extra tabs were read-only dead ends. Work is now a
 * repeatable list of sections in place.
 *
 * Most of what is asserted here is the shape of the `PATCH /v1/profile/me`
 * body, because that endpoint reconciles destructively: `applyGroupArray`
 * deletes any group the body omits, `syncGroupFields` deletes any field a row
 * omits, and `forbidNonWhitelisted` 400s the whole request over one key the DTO
 * does not declare. Every one of those is invisible until it eats a user's data.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ProfilePage from "@/pages/profile-page";
import type { ProfileMeResponse } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  fetchProfileMe: vi.fn(),
  patchProfileMe: vi.fn(),
  deleteProfileGroup: vi.fn(),
  deleteProfilePhoto: vi.fn(),
  uploadProfilePhoto: vi.fn(),
}));

vi.mock("@/context/auth-context", () => ({ useAuth: mocks.useAuth }));

vi.mock("@/lib/profile-api", () => ({
  fetchProfileMe: mocks.fetchProfileMe,
  patchProfileMe: mocks.patchProfileMe,
  deleteProfileGroup: mocks.deleteProfileGroup,
  deleteProfilePhoto: mocks.deleteProfilePhoto,
  uploadProfilePhoto: mocks.uploadProfilePhoto,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const WORK_ONE = "3f1c9b7e-0000-4000-8000-00000000aaa1";
const WORK_TWO = "3f1c9b7e-0000-4000-8000-00000000aaa2";
const BUSINESS_ONE = "3f1c9b7e-0000-4000-8000-00000000bbb1";
const SOCIAL_ONE = "3f1c9b7e-0000-4000-8000-00000000ccc1";
const PERSONAL_ONE = "3f1c9b7e-0000-4000-8000-00000000ddd1";

function profileFixture(): ProfileMeResponse {
  return {
    identity: {
      firstName: "Vansh",
      lastName: "Mehta",
      primaryPhone: "+919953266232",
      primaryEmail: "mvansh705@gmail.com",
      profilePhoto: null,
    },
    personal: {
      groupId: PERSONAL_ONE,
      tag: "Personal",
      mobile: "+919953266232",
      email: "mvansh705@gmail.com",
      dateOfBirth: null,
      postalAddress: {
        street: "Alpha-2",
        city: "Greater Noida",
        state: "Uttar Pradesh",
        pincode: "237982",
        country: "India",
      },
    },
    work: [
      {
        groupId: WORK_ONE,
        tag: "Current Work",
        companyName: "Shava Studios",
        workTitle: "Founder",
        workEmail: "vansh.m@shavastudios.ai",
        // None of these have an input on the page, so a save has to carry them.
        companyLogo: "https://cdn.example.com/logo.png",
        companyRegNumber: "REG-1",
        workMobile: "+911111111111",
        workLandline: "+912222222222",
        workFax: "+913333333333",
        website: "https://shavastudios.ai",
        workPostalAddress: {
          street: "Sector 62",
          city: "Noida",
          state: "Uttar Pradesh",
          pincode: "201309",
          country: "India",
        },
        custom: { industry: "Software", employeeId: "E-9" },
      },
      {
        groupId: WORK_TWO,
        tag: "Side Gig",
        companyName: "Night Shift Co",
        workTitle: "Advisor",
        workEmail: null,
      },
    ],
    business: [
      {
        groupId: BUSINESS_ONE,
        tag: "Primary Business",
        businessName: "Shava Labs LLP",
        businessTitle: "Partner",
        businessRegNumber: "GST-42",
        businessEmail: "hello@shavalabs.in",
        custom: { gstin: "09ABCDE1234F1Z5" },
      },
    ],
    socials: [
      {
        groupId: SOCIAL_ONE,
        tag: "Social",
        twitter: "https://x.com/vansh",
        website: "https://vansh.dev",
        // Neither of these is a key `ProfileMeSocialUpsertDto` declares.
        linkedin: "https://linkedin.com/in/vansh",
        github: "https://github.com/vansh",
        custom: { instagram: "https://instagram.com/vansh" },
      },
    ],
    financial: { bankAccounts: [], digitalWallets: [], cryptoWallets: [] },
  };
}

async function renderLoadedPage(): Promise<void> {
  render(
    <MemoryRouter initialEntries={["/profile"]}>
      <ProfilePage />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Personal information" });
}

/** The section card whose heading matches, so queries stay scoped to one row. */
function section(name: string | RegExp): HTMLElement {
  const heading = screen.getByRole("heading", { name });
  const node = heading.closest("section");
  if (!node) {
    throw new Error(`heading "${String(name)}" is not inside a section`);
  }
  return node;
}

async function openSection(name: string | RegExp): Promise<HTMLElement> {
  const node = section(name);
  await userEvent.click(within(node).getByRole("button", { name: "Edit" }));
  return section(name);
}

/** The most recent `PATCH /v1/profile/me` body. */
function lastPatch(): Record<string, unknown> {
  const calls = mocks.patchProfileMe.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAuth.mockReturnValue({
    userId: "user-1",
    profileIdentity: profileFixture().identity,
    profileOnboardingCompletedAt: "2026-07-01T00:00:00.000Z",
    isAuthenticated: true,
    isLoading: false,
    refreshUser: vi.fn(),
    markAuthenticated: vi.fn(),
    logout: vi.fn(),
  });
  mocks.fetchProfileMe.mockResolvedValue(profileFixture());
  mocks.patchProfileMe.mockResolvedValue(profileFixture());
  mocks.deleteProfileGroup.mockResolvedValue(profileFixture());
});

describe("ProfilePage layout", () => {
  it("drops the tab bar and shows every section on one page", async () => {
    await renderLoadedPage();

    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Social profiles" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Work · Shava Studios" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Work · Night Shift Co" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Business · Shava Labs LLP" }),
    ).toBeTruthy();
  });

  it("renders each workplace's own values rather than only the first", async () => {
    await renderLoadedPage();

    const first = section("Work · Shava Studios");
    expect(within(first).getByText("Founder")).toBeTruthy();
    expect(within(first).getByText("Software")).toBeTruthy();

    const second = section("Work · Night Shift Co");
    expect(within(second).getByText("Advisor")).toBeTruthy();
  });

  it("offers an add affordance for work but not for business", async () => {
    await renderLoadedPage();

    expect(
      screen.getByRole("button", { name: /add another workplace/i }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /add business/i })).toBeNull();
  });

  it("hides the business section entirely when there is none", async () => {
    const empty = profileFixture();
    empty.business = [];
    mocks.fetchProfileMe.mockResolvedValue(empty);

    await renderLoadedPage();

    expect(screen.queryByRole("heading", { name: /^Business/ })).toBeNull();
  });

  it("titles a lone unnamed workplace 'Work'", async () => {
    const one = profileFixture();
    one.work = [{ groupId: WORK_ONE, tag: "Current Work" }];
    mocks.fetchProfileMe.mockResolvedValue(one);

    await renderLoadedPage();

    expect(screen.getByRole("heading", { name: "Work" })).toBeTruthy();
  });
});

describe("ProfilePage work saves", () => {
  it("resends every workplace, so the untouched one is not deleted", async () => {
    await renderLoadedPage();
    const node = await openSection("Work · Shava Studios");

    await userEvent.clear(within(node).getByLabelText("Position"));
    await userEvent.type(within(node).getByLabelText("Position"), "CEO");
    await userEvent.click(within(node).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.patchProfileMe).toHaveBeenCalled());
    const work = lastPatch().work as Array<Record<string, unknown>>;
    expect(work).toHaveLength(2);
    expect(work[0]).toMatchObject({ groupId: WORK_ONE, workTitle: "CEO" });
    expect(work[1]).toMatchObject({
      groupId: WORK_TWO,
      companyName: "Night Shift Co",
      workTitle: "Advisor",
    });
  });

  it("carries the keys the page has no input for", async () => {
    await renderLoadedPage();
    const node = await openSection("Work · Shava Studios");

    await userEvent.clear(within(node).getByLabelText("Position"));
    await userEvent.type(within(node).getByLabelText("Position"), "CEO");
    await userEvent.click(within(node).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.patchProfileMe).toHaveBeenCalled());
    const row = (lastPatch().work as Array<Record<string, unknown>>)[0];
    expect(row).toMatchObject({
      companyLogo: "https://cdn.example.com/logo.png",
      companyRegNumber: "REG-1",
      workMobile: "+911111111111",
      workLandline: "+912222222222",
      workFax: "+913333333333",
      website: "https://shavastudios.ai",
    });
    expect(row.workPostalAddress).toMatchObject({ city: "Noida" });
    // `employeeId` has no home in ProfileMeWorkUpsertDto, so it rides in custom.
    expect(row.custom).toMatchObject({ industry: "Software", employeeId: "E-9" });
  });

  it("sends no groupId for a workplace being added", async () => {
    await renderLoadedPage();

    await userEvent.click(
      screen.getByRole("button", { name: /add another workplace/i }),
    );
    const node = section("New workplace");
    await userEvent.type(within(node).getByLabelText("Company"), "Third Co");
    await userEvent.click(within(node).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.patchProfileMe).toHaveBeenCalled());
    const work = lastPatch().work as Array<Record<string, unknown>>;
    expect(work).toHaveLength(3);
    expect(work[2]).toMatchObject({ companyName: "Third Co" });
    expect(work[2]).not.toHaveProperty("groupId");
  });

  it("drops a cleared industry from custom instead of storing a blank", async () => {
    await renderLoadedPage();
    const node = await openSection("Work · Shava Studios");

    await userEvent.clear(within(node).getByLabelText("Industry"));
    await userEvent.click(within(node).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.patchProfileMe).toHaveBeenCalled());
    const row = (lastPatch().work as Array<Record<string, unknown>>)[0];
    expect(row.custom).not.toHaveProperty("industry");
    expect(row.custom).toMatchObject({ employeeId: "E-9" });
  });

  it("only opens one section at a time", async () => {
    await renderLoadedPage();
    await openSection("Work · Shava Studios");

    expect(
      within(section("Work · Shava Studios")).getByLabelText("Company"),
    ).toBeTruthy();
    expect(
      within(section("Work · Night Shift Co")).queryByLabelText("Company"),
    ).toBeNull();
  });
});

describe("ProfilePage business saves", () => {
  it("resends the business row with its untouched keys", async () => {
    await renderLoadedPage();
    const node = await openSection("Business · Shava Labs LLP");

    await userEvent.clear(within(node).getByLabelText("Title"));
    await userEvent.type(within(node).getByLabelText("Title"), "Managing Partner");
    await userEvent.click(within(node).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.patchProfileMe).toHaveBeenCalled());
    const rows = lastPatch().business as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      groupId: BUSINESS_ONE,
      businessName: "Shava Labs LLP",
      businessTitle: "Managing Partner",
      businessRegNumber: "GST-42",
    });
    expect(rows[0].custom).toMatchObject({ gstin: "09ABCDE1234F1Z5" });
  });
});

describe("ProfilePage social saves", () => {
  it("routes linkedin and github through custom, never the top level", async () => {
    await renderLoadedPage();
    const node = await openSection("Social profiles");

    await userEvent.clear(within(node).getByLabelText("LinkedIn"));
    await userEvent.type(
      within(node).getByLabelText("LinkedIn"),
      "https://linkedin.com/in/vanshm",
    );
    await userEvent.click(within(node).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.patchProfileMe).toHaveBeenCalled());
    const row = (lastPatch().socials as Array<Record<string, unknown>>)[0];
    expect(row).not.toHaveProperty("linkedin");
    expect(row).not.toHaveProperty("github");
    expect(row.custom).toMatchObject({
      linkedin: "https://linkedin.com/in/vanshm",
      github: "https://github.com/vansh",
      instagram: "https://instagram.com/vansh",
    });
    expect(row).toMatchObject({
      groupId: SOCIAL_ONE,
      twitter: "https://x.com/vansh",
      website: "https://vansh.dev",
    });
  });

  it("reads LinkedIn back out of custom", async () => {
    const stored = profileFixture();
    stored.socials[0].linkedin = null;
    stored.socials[0].custom = { linkedin: "https://linkedin.com/in/fromcustom" };
    mocks.fetchProfileMe.mockResolvedValue(stored);

    await renderLoadedPage();

    expect(
      within(section("Social profiles")).getByText(
        "https://linkedin.com/in/fromcustom",
      ),
    ).toBeTruthy();
  });
});

describe("ProfilePage removal", () => {
  it("confirms before removing a workplace, then deletes the group", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderLoadedPage();
    const node = await openSection("Work · Shava Studios");

    await userEvent.click(
      within(node).getByRole("button", { name: /remove this workplace/i }),
    );

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() =>
      expect(mocks.deleteProfileGroup).toHaveBeenCalledWith(WORK_ONE, "WORK"),
    );
    confirmSpy.mockRestore();
  });

  it("keeps the group when the confirm is dismissed", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    await renderLoadedPage();
    const node = await openSection("Work · Shava Studios");

    await userEvent.click(
      within(node).getByRole("button", { name: /remove this workplace/i }),
    );

    expect(mocks.deleteProfileGroup).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("offers no remove on a workplace that was never saved", async () => {
    await renderLoadedPage();

    await userEvent.click(
      screen.getByRole("button", { name: /add another workplace/i }),
    );

    expect(
      within(section("New workplace")).queryByRole("button", {
        name: /remove this workplace/i,
      }),
    ).toBeNull();
  });
});
