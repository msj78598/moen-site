import { describe, it, expect } from "vitest";
import { normalizeJordanPhone, looksLikeValidPhone, whatsAppUrl } from "../phone.js";

describe("normalizeJordanPhone", () => {
  it("يحوّل الصيغة المحلية إلى الدولية", () => {
    expect(normalizeJordanPhone("0772050566")).toBe("962772050566");
    expect(normalizeJordanPhone("0796181720")).toBe("962796181720");
  });

  it("يحوّل صيغة 00962", () => {
    expect(normalizeJordanPhone("00962772050566")).toBe("962772050566");
  });

  it("يبقي الصيغة الدولية كما هي", () => {
    expect(normalizeJordanPhone("962772050566")).toBe("962772050566");
  });

  it("يزيل المسافات والرموز", () => {
    expect(normalizeJordanPhone("+962 77 205 0566")).toBe("962772050566");
    expect(normalizeJordanPhone("077-205-0566")).toBe("962772050566");
    expect(normalizeJordanPhone("(077) 2050566")).toBe("962772050566");
  });

  it("يعيد نصًا فارغًا للمدخلات الفارغة", () => {
    expect(normalizeJordanPhone("")).toBe("");
    expect(normalizeJordanPhone(null)).toBe("");
    expect(normalizeJordanPhone(undefined)).toBe("");
    expect(normalizeJordanPhone("أحرف فقط")).toBe("");
  });

  it("متوافق مع السلوك السابق لدالة normalPhone", () => {
    // السلوك القديم في src/App.jsx كان يطبّق الاستبدالات ثم يزيل غير الأرقام.
    const legacy = (phone) =>
      (phone || "").replace(/^00962/, "962").replace(/^0/, "962").replace(/\D/g, "");

    for (const sample of ["0772050566", "00962772050566", "962797022220", ""]) {
      expect(normalizeJordanPhone(sample)).toBe(legacy(sample));
    }
  });
});

describe("looksLikeValidPhone", () => {
  it("يقبل الأرقام الأردنية الحقيقية", () => {
    expect(looksLikeValidPhone("0772050566")).toBe(true);
    expect(looksLikeValidPhone("00962797022220")).toBe(true);
  });

  it("يرفض القصير جدًا والفارغ", () => {
    expect(looksLikeValidPhone("123")).toBe(false);
    expect(looksLikeValidPhone("")).toBe(false);
    expect(looksLikeValidPhone(null)).toBe(false);
  });
});

describe("whatsAppUrl", () => {
  it("يبني رابطًا صحيحًا بلا نص", () => {
    expect(whatsAppUrl("0772050566")).toBe("https://wa.me/962772050566");
  });

  it("يرمّز النص العربي", () => {
    const url = whatsAppUrl("0772050566", "استفسار عن عرض");
    expect(url.startsWith("https://wa.me/962772050566?text=")).toBe(true);
    expect(url).not.toContain(" ");
  });
});
