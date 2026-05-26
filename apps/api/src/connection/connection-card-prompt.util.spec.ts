import {
  buildCardOptions,
  resolveCardIdFromInbound,
} from "./connection-card-prompt.util";

describe("connection-card-prompt.util", () => {
  const options = buildCardOptions([
    {
      id: "card-a",
      userId: "u1",
      name: "Personal",
      type: "PERSONAL",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "card-b",
      userId: "u1",
      name: "Work",
      type: "CUSTOM",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  it("resolves numeric and name replies", () => {
    expect(resolveCardIdFromInbound("1", options)).toBe("card-a");
    expect(resolveCardIdFromInbound("work", options)).toBe("card-b");
    expect(resolveCardIdFromInbound("card-a", options)).toBe("card-a");
  });
});
