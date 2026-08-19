import { describe, it, expect } from "vitest";
import {
  toLatinDigits, isGarbage,
  normalizeType, normalizeLocation, normalizeSize, normalizePrice,
  normalizeOffer, NO_PRICE_TEXT,
} from "../ingestion/normalize.js";

describe("toLatinDigits", () => {
  it("يحوّل الأرقام العربية", () => {
    expect(toLatinDigits("٤دنانير")).toBe("4دنانير");
    expect(toLatinDigits("١٢٣٤٥")).toBe("12345");
  });
  it("يترك اللاتينية كما هي", () => {
    expect(toLatinDigits("120,000")).toBe("120,000");
  });
});

describe("isGarbage — القيم المشوّهة الحقيقية من الإنتاج", () => {
  it('يرفض ".."', () => expect(isGarbage("..")).toBe(true));
  it("يرفض الفراغ والرموز", () => {
    for (const v of ["", "   ", "-", "؟", "***", null, undefined]) {
      expect(isGarbage(v)).toBe(true);
    }
  });
  it("يقبل القيم الحقيقية", () => {
    expect(isGarbage("120,000")).toBe(false);
    expect(isGarbage("أرض سكنية")).toBe(false);
  });
});

describe("normalizeType", () => {
  it("يصنّف الأنواع العربية", () => {
    expect(normalizeType("ارض زراعية").category).toBe("land");
    expect(normalizeType("قطعه ارض").category).toBe("land");
    expect(normalizeType("شقة").category).toBe("apartment");
    expect(normalizeType("فيلا").category).toBe("villa");
    expect(normalizeType("منزل للبيع").category).toBe("house");
    expect(normalizeType("عمارة").category).toBe("building");
    expect(normalizeType("مزرعة").category).toBe("farm");
    expect(normalizeType("محل تجاري").category).toBe("shop");
  });
  it("لا يخترع تصنيفًا لنوع مجهول — يحتفظ بالنص", () => {
    const r = normalizeType("شيء غامض");
    expect(r.category).toBeNull();
    expect(r.raw).toBe("شيء غامض");
  });
  it("يتعامل مع القمامة", () => {
    expect(normalizeType("..").category).toBeNull();
    expect(normalizeType("..").raw).toBe("");
  });
});

describe("normalizeLocation", () => {
  it("يزيل تكرار المدينة — حالة حقيقية من الإنتاج", () => {
    // "إربد - اربد - الطوال" : إربد و اربد نفس المقطع باختلاف الهمزة
    expect(normalizeLocation("إربد - اربد - الطوال").display).toBe("إربد - الطوال");
  });
  it("يحافظ على المقاطع المختلفة", () => {
    expect(normalizeLocation("إربد - ايدون - الطوال").display).toBe("إربد - ايدون - الطوال");
  });
  it("ينتج مفتاح مقارنة موحّدًا", () => {
    const a = normalizeLocation("إربد - إيدون");
    const b = normalizeLocation("اربد - ايدون");
    expect(a.key).toBe(b.key);
  });
  it("يتعامل مع الفارغ", () => {
    expect(normalizeLocation("..").display).toBe("");
    expect(normalizeLocation(null).segments).toEqual([]);
  });
});

describe("normalizeSize", () => {
  it("يستخرج المتر المربع بصيغه المختلفة", () => {
    expect(normalizeSize("854 م²").m2).toBe(854);
    expect(normalizeSize("28700 م2").m2).toBe(28700);
    expect(normalizeSize("المساحه 545م2").m2).toBe(545);
    expect(normalizeSize("1,067 متر").m2).toBe(1067);
  });
  it("يحوّل الدونم", () => {
    expect(normalizeSize("3 دونم").m2).toBe(3000);
  });
  it("يعيد null للمساحة المفقودة — ولا يخترع رقمًا", () => {
    expect(normalizeSize("..").m2).toBeNull();
    expect(normalizeSize("").m2).toBeNull();
    expect(normalizeSize("تضاف المساحة").m2).toBeNull();
  });
});

describe("normalizePrice", () => {
  it("يقرأ السعر العادي", () => {
    const r = normalizePrice("120,000");
    expect(r.amount).toBe(120000);
    expect(r.currency).toBe("JOD");
    expect(r.unit).toBe("total");
  });

  it('يرفض السعر المشوّه ".." ويعيد نص التواصل', () => {
    const r = normalizePrice("..");
    expect(r.amount).toBeNull();
    expect(r.display).toBe(NO_PRICE_TEXT);
  });

  it("يقرأ السعر بالمتر بأرقام عربية — ولا يضربه بالمساحة", () => {
    const r = normalizePrice("٤دنانير للمتر");
    expect(r.amount).toBe(4);
    expect(r.unit).toBe("per_m2");
    expect(r.display).toContain("للمتر");
  });

  it("يتعرّف على العملات", () => {
    expect(normalizePrice("50,000 دولار").currency).toBe("USD");
    expect(normalizePrice("80,000 دينار").currency).toBe("JOD");
  });

  it("يعتبر نصوص التواصل غياب سعر", () => {
    for (const v of ["السعر عند التواصل", "السعر حسب المصدر / عند التواصل", "للاستفسار"]) {
      expect(normalizePrice(v).amount).toBeNull();
      expect(normalizePrice(v).display).toBe(NO_PRICE_TEXT);
    }
  });

  it("يرفض الصفر والسالب", () => {
    expect(normalizePrice("0").amount).toBeNull();
  });
});

describe("normalizeOffer", () => {
  it("يبني عرضًا مُطبَّعًا كاملًا", () => {
    const o = normalizeOffer(
      { type: "ارض زراعية", location: "إربد - اربد - المغير", size: "854 متر", price: "80,000 دينار",
        source_url: "https://daleelaqar.com/x", listing_code: "LST1" },
      { sourceName: "دليل عقار" }
    );
    expect(o.type_category).toBe("land");
    expect(o.location).toBe("إربد - المغير");
    expect(o.size_m2).toBe(854);
    expect(o.price_amount).toBe(80000);
    expect(o.source_name).toBe("دليل عقار");
  });

  it("يحفظ القيم الخام للتدقيق ولا يفقدها", () => {
    const o = normalizeOffer({ type: "أرض", location: "إربد", size: "..", price: ".." });
    expect(o.raw.price).toBe("..");
    expect(o.raw.size).toBe("..");
    expect(o.price_amount).toBeNull();
    expect(o.size_m2).toBeNull();
  });
});
