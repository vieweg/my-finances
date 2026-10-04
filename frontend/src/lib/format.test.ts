import { formatCurrency, formatDate } from "./format";

describe("formatCurrency", () => {
  it("formats BRL by default", () => {
    expect(formatCurrency(1234.56)).toBe("R$ 1.234,56");
  });

  it("formats a different currency", () => {
    expect(formatCurrency(1000, "USD")).toBe("US$ 1.000,00");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("R$ 0,00");
  });

  it("formats negative values", () => {
    expect(formatCurrency(-50)).toBe("-R$ 50,00");
  });
});

describe("formatDate", () => {
  it("formats a Date object as dd/MM/yyyy", () => {
    expect(formatDate(new Date(2024, 0, 5))).toBe("05/01/2024");
  });

  it("formats an ISO date string", () => {
    expect(formatDate("2024-12-31T00:00:00.000Z")).toBe("31/12/2024");
  });

  it("pads single-digit days and months", () => {
    expect(formatDate(new Date(2023, 2, 7))).toBe("07/03/2023");
  });
});
