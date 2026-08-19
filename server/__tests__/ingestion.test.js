import { describe, it, expect, vi } from "vitest";
import { runIngestion, runAllSources } from "../ingestion/pipeline.js";
import { createFixtureFetcher } from "../ingestion/fetcher.js";
import { evaluateSource, selectRunnable, BLOCK_REASON } from "../sources/registry.js";
import { dedupe, fuzzyKey, canonicalUrl } from "../ingestion/dedupe.js";
import { scoreOffer, decide } from "../ingestion/score.js";
import { validateOffer, isHostAllowed, REJECT_REASON } from "../ingestion/validate.js";
import { normalizeOffer, NO_PRICE_TEXT } from "../ingestion/normalize.js";
import {
  PAGES, DEGRADED_PAGES, EMPTY_PAGES, URLS,
  GRANTED_SOURCE, PENDING_SOURCE, DISABLED_SOURCE, DENIED_SOURCE,
} from "../ingestion/__fixtures__/daleelaqar.js";

const fetcher = createFixtureFetcher(PAGES);

// ===============================================================
// بوابة المصادر
// ===============================================================
describe("بوابة المصادر", () => {
  it("مصدر pending ممنوع", () => {
    const v = evaluateSource(PENDING_SOURCE);
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe(BLOCK_REASON.NOT_GRANTED);
  });

  it("مصدر disabled ممنوع رغم أن إذنه ممنوح", () => {
    const v = evaluateSource(DISABLED_SOURCE);
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe(BLOCK_REASON.DISABLED);
  });

  it("مصدر denied ممنوع", () => {
    expect(evaluateSource(DENIED_SOURCE).allowed).toBe(false);
  });

  it("مصدر غير مصرّح (بلا محوّل) ممنوع", () => {
    const v = evaluateSource({ ...GRANTED_SOURCE, adapter: null });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe(BLOCK_REASON.NO_ADAPTER);
  });

  it("مصدر مجهول ممنوع", () => {
    expect(evaluateSource(null).reason).toBe(BLOCK_REASON.UNKNOWN_SOURCE);
  });

  it("المصدر المسموح وحده يمرّ", () => {
    expect(evaluateSource(GRANTED_SOURCE).allowed).toBe(true);
  });

  it("selectRunnable يفصل المسموح عن الممنوع", () => {
    const { runnable, blocked } = selectRunnable([GRANTED_SOURCE, PENDING_SOURCE, DENIED_SOURCE]);
    expect(runnable).toHaveLength(1);
    expect(blocked).toHaveLength(2);
  });
});

// ===============================================================
// البوابة تمنع حتى الاتصال
// ===============================================================
describe("المصدر الممنوع لا يصل إلى الشبكة إطلاقًا", () => {
  it("لا يُستدعى الجالب لمصدر pending", async () => {
    const spy = { fetchPage: vi.fn() };
    const report = await runIngestion(PENDING_SOURCE, { fetcher: spy });
    expect(spy.fetchPage).not.toHaveBeenCalled();
    expect(report.skipped).toBe(true);
    expect(report.skipReason).toBe(BLOCK_REASON.NOT_GRANTED);
    expect(report.toPublish).toHaveLength(0);
  });

  it("لا يُستدعى الجالب لمصدر disabled", async () => {
    const spy = { fetchPage: vi.fn() };
    await runIngestion(DISABLED_SOURCE, { fetcher: spy });
    expect(spy.fetchPage).not.toHaveBeenCalled();
  });
});

// ===============================================================
// الخط الكامل
// ===============================================================
describe("خط الاستيعاب — المسار السليم", () => {
  it("ينتج عروضًا قابلة للنشر من صفحة سليمة", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    expect(r.skipped).toBe(false);
    expect(r.degraded).toBe(false);
    expect(r.stages.extract.strategy).toBe("jsonld");
    expect(r.toPublish.length).toBeGreaterThan(0);
  });

  it("العرض الكامل يُنشر بسعره الصحيح", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    const complete = r.toPublish.find((o) => canonicalUrl(o.source_url) === canonicalUrl(URLS.complete));
    expect(complete).toBeTruthy();
    expect(complete.price_amount).toBe(80000);
    expect(complete.type_category).toBe("land");
    expect(complete.size_m2).toBe(854);
  });

  it("العرض بلا سعر يُنشر بنص التواصل — لا يُرفض", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    const noPrice = [...r.toPublish, ...r.toReview].find((o) => canonicalUrl(o.source_url) === canonicalUrl(URLS.noPrice));
    expect(noPrice).toBeTruthy();
    expect(noPrice.price_amount).toBeNull();
    expect(noPrice.price).toBe(NO_PRICE_TEXT);
  });

  it('العرض بسعر مشوّه ".." لا يحمل رقمًا مخترعًا', async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    const bad = [...r.toPublish, ...r.toReview].find((o) => canonicalUrl(o.source_url) === canonicalUrl(URLS.badPrice));
    expect(bad).toBeTruthy();
    expect(bad.price_amount).toBeNull();
    expect(bad.price).toBe(NO_PRICE_TEXT);
  });

  it("العرض المكرر لا يُدرج مرتين", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    const urls = r.toPublish.map((o) => o.source_url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(r.duplicates.some((d) => d.reason === "duplicate_in_batch")).toBe(true);
  });

  it("الرابط من نطاق أجنبي يُرفض", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    const published = [...r.toPublish, ...r.toReview].map((o) => o.source_url);
    expect(published.map(canonicalUrl)).not.toContain(canonicalUrl(URLS.foreign));
  });

  it("البيانات الناقصة (صفحة ليست إعلانًا) تُستبعد", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    const all = [...r.toPublish, ...r.toReview].map((o) => o.source_url);
    expect(all.map(canonicalUrl)).not.toContain(canonicalUrl(URLS.unparsable));
    expect(r.stages.extract.unparsable).toBeGreaterThan(0);
  });
});

// ===============================================================
// إعادة الفحص
// ===============================================================
describe("إعادة فحص المصدر لا تُدرج ما هو موجود", () => {
  it("الروابط المعروفة تُصنَّف already_in_database", async () => {
    const first = await runIngestion(GRANTED_SOURCE, { fetcher });
    const knownUrls = new Set(first.toPublish.map((o) => o.source_url));

    const second = await runIngestion(GRANTED_SOURCE, { fetcher, knownUrls });
    expect(second.toPublish).toHaveLength(0);
    expect(second.duplicates.some((d) => d.reason === "already_in_database")).toBe(true);
  });
});

// ===============================================================
// التدهور
// ===============================================================
describe("كشف تدهور الاستخراج", () => {
  it("غياب JSON-LD يُعلَن صراحةً بـ degraded", async () => {
    const r = await runIngestion(GRANTED_SOURCE, {
      fetcher: createFixtureFetcher(DEGRADED_PAGES),
    });
    expect(r.degraded).toBe(true);
    expect(r.stages.extract.strategy).toBe("links");
  });

  it("في الوضع المتدهور تختفي الأسعار — كما حدث فعلًا في الإنتاج", async () => {
    const r = await runIngestion(GRANTED_SOURCE, {
      fetcher: createFixtureFetcher(DEGRADED_PAGES),
    });
    const all = [...r.toPublish, ...r.toReview];
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((o) => o.price_amount === null)).toBe(true);
  });

  it("الصفحة الفارغة لا تنتج شيئًا ولا ترمي استثناء", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher: createFixtureFetcher(EMPTY_PAGES) });
    expect(r.skipped).toBe(false);
    expect(r.toPublish).toHaveLength(0);
  });

  it("فشل الجلب يُعزل ولا يُسقط الخط", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher: createFixtureFetcher({}) });
    expect(r.skipped).toBe(true);
    expect(r.skipReason).toBe("fetch_failed");
  });
});

// ===============================================================
// وحدات مستقلة
// ===============================================================
describe("isHostAllowed", () => {
  it("يقبل النطاق ونطاقاته الفرعية", () => {
    expect(isHostAllowed("https://daleelaqar.com/x", "daleelaqar.com")).toBe(true);
    expect(isHostAllowed("https://www.daleelaqar.com/x", "daleelaqar.com")).toBe(true);
  });
  it("يرفض نطاقًا آخر ومحاولات التحايل", () => {
    expect(isHostAllowed("https://evil.com/x", "daleelaqar.com")).toBe(false);
    expect(isHostAllowed("https://daleelaqar.com.evil.com/x", "daleelaqar.com")).toBe(false);
    expect(isHostAllowed("ليس رابطًا", "daleelaqar.com")).toBe(false);
  });
});

describe("validateOffer", () => {
  const base = normalizeOffer(
    { type: "أرض", location: "إربد - ايدون", size: "500 م²", price: "50,000",
      source_url: "https://daleelaqar.com/a" },
    { sourceName: "دليل عقار" }
  );

  it("يقبل العرض الصحيح", () => {
    expect(validateOffer(base, { allowedHost: "daleelaqar.com" }).ok).toBe(true);
  });
  it("يرفض العرض بلا رابط مصدر — لا نشر لما لا يُثبت", () => {
    const r = validateOffer({ ...base, source_url: "" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(REJECT_REASON.NO_SOURCE_URL);
  });
  it("يرفض العرض بلا نوع أو بلا موقع", () => {
    expect(validateOffer({ ...base, type: "" }).reason).toBe(REJECT_REASON.NO_TYPE);
    expect(validateOffer({ ...base, location: "" }).reason).toBe(REJECT_REASON.NO_LOCATION);
  });
});

describe("dedupe", () => {
  const mk = (url, extra = {}) => ({
    source_url: url, type_category: "land", location_key: "اربد|ايدون",
    size_m2: 500, price_amount: 50000, ...extra,
  });

  it("يزيل التكرار داخل الدفعة", () => {
    const { unique, duplicates } = dedupe([mk("https://a/1"), mk("https://a/1")]);
    expect(unique).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
  });

  it("يستبعد ما هو موجود في قاعدة البيانات", () => {
    const { unique, duplicates } = dedupe([mk("https://a/1")], {
      knownUrls: new Set(["https://a/1"]),
    });
    expect(unique).toHaveLength(0);
    expect(duplicates[0].reason).toBe("already_in_database");
  });

  it("يشتبه بالمتشابه دون حذفه — القرار للإنسان", () => {
    const { unique, suspected } = dedupe([mk("https://a/1"), mk("https://a/2")]);
    expect(unique).toHaveLength(2);
    expect(suspected).toHaveLength(1);
    expect(unique[1].possible_duplicate_of).toBe("https://a/1");
  });

  it("لا يطابق على بيانات ناقصة", () => {
    expect(fuzzyKey({ type_category: "land", location_key: "x" })).toBeNull();
  });
});

describe("درجة الجودة", () => {
  it("العرض الكامل يتجاوز عتبة النشر", () => {
    const full = normalizeOffer(
      { type: "أرض", location: "إربد - ايدون", size: "500 م²", price: "50,000",
        source_url: "https://daleelaqar.com/a", listing_code: "LST1" },
      { sourceName: "س" }
    );
    expect(decide(full).action).toBe("publish");
    expect(scoreOffer(full).score).toBeGreaterThanOrEqual(60);
  });

  it("العرض شبه الفارغ يذهب للمراجعة لا للنشر", () => {
    const poor = normalizeOffer(
      { type: "أرض", location: "إربد", size: "..", price: "..", source_url: "https://d.com/a" },
      { sourceName: "س" }
    );
    const d = decide(poor);
    expect(d.action).toBe("review");
    expect(d.missing).toContain("hasSize");
  });

  it("الدرجة مفسَّرة لا رقمًا ثابتًا — بديل quality_score=85 القديم", () => {
    const s = scoreOffer(normalizeOffer({ type: "أرض", location: "إربد", source_url: "https://d.com/a" }));
    expect(s.breakdown).toHaveProperty("hasSourceUrl");
    expect(s.missing.length).toBeGreaterThan(0);
  });
});

// ===============================================================
// عدة مصادر
// ===============================================================
describe("runAllSources", () => {
  it("يشغّل المسموح ويتخطى الممنوع", async () => {
    const { totals } = await runAllSources(
      [GRANTED_SOURCE, PENDING_SOURCE, DISABLED_SOURCE],
      { fetcher }
    );
    expect(totals.sources).toBe(3);
    expect(totals.ran).toBe(1);
    expect(totals.skipped).toBe(2);
    expect(totals.toPublish).toBeGreaterThan(0);
  });
});

describe("canonicalUrl — يحرس عيب ترميز الروابط العربية", () => {
  it("الرابط الخام والمرمّز ينتجان نفس المفتاح", () => {
    const raw = "https://daleelaqar.com/nav/عقارات/اربد";
    const encoded = "https://daleelaqar.com/nav/%D8%B9%D9%82%D8%A7%D8%B1%D8%A7%D8%AA/%D8%A7%D8%B1%D8%A8%D8%AF";
    expect(canonicalUrl(raw)).toBe(canonicalUrl(encoded));
  });

  it("يوحّد www والشظية والشرطة النهائية", () => {
    expect(canonicalUrl("https://www.d.com/a/")).toBe(canonicalUrl("https://d.com/a"));
    expect(canonicalUrl("https://d.com/a#frag")).toBe(canonicalUrl("https://d.com/a"));
  });

  it("بدون التوحيد كان العرض نفسه يُدرج مرتين", () => {
    const raw = "https://daleelaqar.com/nav/عقارات/اربد";
    const encoded = "https://daleelaqar.com/nav/%D8%B9%D9%82%D8%A7%D8%B1%D8%A7%D8%AA/%D8%A7%D8%B1%D8%A8%D8%AF";
    const { unique, duplicates } = dedupe([
      { source_url: raw }, { source_url: encoded },
    ]);
    expect(unique).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
  });
});

describe("المحوّل لا يعرض كلمات بنيوية كأنها أحياء", () => {
  it("يستبعد للبيع/عقارات/حوض والأرقام من الموقع", async () => {
    const { parseListingUrl } = await import("../ingestion/adapters/daleelaqar.js");
    const parsed = parseListingUrl(
      "https://daleelaqar.com/nav/عقارات/اربد/حوض/أرض/للبيع/854-متر/ايدون/LST100234"
    );
    expect(parsed).toBeTruthy();
    for (const bad of ["للبيع", "عقارات", "حوض", "nav"]) {
      expect(parsed.location).not.toContain(bad);
    }
    expect(parsed.location).toContain("ايدون");
    expect(parsed.listing_code).toBe("LST100234");
  });

  it("يرفض الرابط الذي لا يطابق الشكل المتوقع بلا تخمين", async () => {
    const { parseListingUrl } = await import("../ingestion/adapters/daleelaqar.js");
    expect(parseListingUrl("https://daleelaqar.com/about-us")).toBeNull();
    expect(parseListingUrl("ليس رابطًا")).toBeNull();
  });
});
