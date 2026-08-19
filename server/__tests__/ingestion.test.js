import { describe, it, expect, vi } from "vitest";
import { runIngestion, runAllSources, RUN_STATUS, ERROR_CODE } from "../ingestion/pipeline.js";
import { createFixtureFetcher, createHttpFetcher } from "../ingestion/fetcher.js";
import {
  evaluateSource, selectRunnable, assertRunnable,
  BLOCK_REASON, PermissionDeniedError,
} from "../ingestion/permission-gate.js";
import { sourceConfig, isDueForRun, SOURCE_DEFAULTS } from "../sources/registry.js";
import { dedupe, fuzzyKey, canonicalUrl } from "../ingestion/dedupe.js";
import { scoreOffer, decide } from "../ingestion/score.js";
import { validateOffer, isHostAllowed, REJECT_REASON, BOUNDS } from "../ingestion/validate.js";
import { normalizeOffer, normalizeTitle, NO_PRICE_TEXT } from "../ingestion/normalize.js";
import {
  PAGES, DEGRADED_PAGES, EMPTY_PAGES, URLS,
  GRANTED_SOURCE, PENDING_SOURCE, DISABLED_SOURCE, DENIED_SOURCE,
} from "../ingestion/__fixtures__/daleelaqar.js";

const fetcher = createFixtureFetcher(PAGES);
const sameUrl = (a, b) => canonicalUrl(a) === canonicalUrl(b);
const findByUrl = (report, url) =>
  [...report.publish_candidates, ...report.review_required].find((o) => sameUrl(o.source_url, url));

// ===============================================================
// بوابة الإذن كطبقة مستقلة
// ===============================================================
describe("Permission Gate", () => {
  it("pending ممنوع", () => {
    const v = evaluateSource(PENDING_SOURCE);
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe(BLOCK_REASON.PERMISSION_PENDING);
    expect(v.message).toBeTruthy();
  });

  it("denied ممنوع", () => {
    expect(evaluateSource(DENIED_SOURCE).reason).toBe(BLOCK_REASON.PERMISSION_DENIED);
  });

  it("disabled ممنوع رغم أن الإذن ممنوح", () => {
    expect(evaluateSource(DISABLED_SOURCE).reason).toBe(BLOCK_REASON.DISABLED);
  });

  it("محوّل مفقود ممنوع", () => {
    expect(evaluateSource({ ...GRANTED_SOURCE, adapter: null }).reason).toBe(BLOCK_REASON.NO_ADAPTER);
    expect(evaluateSource(GRANTED_SOURCE, { hasAdapter: () => false }).reason)
      .toBe(BLOCK_REASON.NO_ADAPTER);
  });

  it("مصدر مجهول ممنوع", () => {
    for (const bad of [null, undefined, "نص", 42]) {
      expect(evaluateSource(bad).reason).toBe(BLOCK_REASON.UNKNOWN_SOURCE);
    }
  });

  it("granted + enabled + adapter هي الحالة الوحيدة المسموحة", () => {
    expect(evaluateSource(GRANTED_SOURCE).allowed).toBe(true);
  });

  it("assertRunnable ترمي خطأً صريحًا", () => {
    expect(() => assertRunnable(PENDING_SOURCE)).toThrow(PermissionDeniedError);
    expect(() => assertRunnable(GRANTED_SOURCE)).not.toThrow();
  });

  it("selectRunnable تفصل وتذكر السبب", () => {
    const { runnable, blocked } = selectRunnable([
      GRANTED_SOURCE, PENDING_SOURCE, DENIED_SOURCE, DISABLED_SOURCE,
    ]);
    expect(runnable).toHaveLength(1);
    expect(blocked.map((b) => b.reason)).toEqual([
      BLOCK_REASON.PERMISSION_PENDING,
      BLOCK_REASON.PERMISSION_DENIED,
      BLOCK_REASON.DISABLED,
    ]);
  });
});

// ===============================================================
// الجالب لا يُستدعى عند المنع
// ===============================================================
describe("المصدر الممنوع لا يصل إلى الشبكة", () => {
  for (const [label, source] of [
    ["pending", PENDING_SOURCE],
    ["denied", DENIED_SOURCE],
    ["disabled", DISABLED_SOURCE],
    ["بلا محوّل", { ...GRANTED_SOURCE, adapter: "no_such_adapter" }],
  ]) {
    it(`الجالب لا يُستدعى لمصدر ${label}`, async () => {
      const spy = { fetchPage: vi.fn() };
      const report = await runIngestion(source, { fetcher: spy });
      expect(spy.fetchPage).not.toHaveBeenCalled();
      expect(report.status).toBe(RUN_STATUS.SKIPPED);
      expect(report.publish_candidates).toHaveLength(0);
      expect(report.errors[0].code).toBeTruthy();
    });
  }
});

// ===============================================================
// المسار السليم وعقد التقرير
// ===============================================================
describe("Pipeline — المسار السليم", () => {
  it("يعيد عقد التقرير كاملًا", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    for (const field of [
      "source", "status", "started_at", "completed_at", "duration_ms",
      "fetched_count", "valid_count", "invalid_count", "duplicate_count",
      "publish_candidates", "review_required", "degraded", "errors",
    ]) {
      expect(r, `الحقل ${field} مفقود`).toHaveProperty(field);
    }
    expect(r.status).toBe(RUN_STATUS.COMPLETED);
    expect(r.errors).toEqual([]);
    expect(Date.parse(r.completed_at)).toBeGreaterThanOrEqual(Date.parse(r.started_at));
  });

  it("الأعداد متسقة مع المحتوى", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    expect(r.fetched_count).toBeGreaterThan(0);
    expect(r.valid_count + r.invalid_count).toBe(r.fetched_count);
    expect(r.publish_candidates.length + r.review_required.length)
      .toBe(r.valid_count - r.duplicate_count);
  });

  it("العرض الصحيح يصبح publish_candidate بسعره ومساحته وعنوانه", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    const o = r.publish_candidates.find((x) => sameUrl(x.source_url, URLS.complete));
    expect(o).toBeTruthy();
    expect(o.price_amount).toBe(80000);
    expect(o.price_currency).toBe("JOD");
    expect(o.size_m2).toBe(854);
    expect(o.type_category).toBe("land");
    expect(o.title).toBe("أرض للبيع");
    expect(o.quality_score).toBe(100);
  });

  it("العرض بلا سعر يمرّ بـ«السعر عند التواصل» ولا يُرفض", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    const o = findByUrl(r, URLS.noPrice);
    expect(o).toBeTruthy();
    expect(o.price_amount).toBeNull();
    expect(o.price).toBe(NO_PRICE_TEXT);
  });

  it('السعر المشوّه ".." لا يتحول إلى رقم', async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    const o = findByUrl(r, URLS.badPrice);
    expect(o).toBeTruthy();
    expect(o.price_amount).toBeNull();
    expect(o.price).toBe(NO_PRICE_TEXT);
  });

  it("الرابط من نطاق أجنبي يُرفض", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    expect(findByUrl(r, URLS.foreign)).toBeUndefined();
  });

  it("ما لا يطابق شكل الإعلان يُستبعد بلا تخمين", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    expect(findByUrl(r, URLS.unparsable)).toBeUndefined();
    expect(r.details.stages.extract.unparsable).toBeGreaterThan(0);
  });
});

// ===============================================================
// التكرار وتوحيد الروابط
// ===============================================================
describe("Deduplication", () => {
  it("المكرر داخل الدفعة يُحسب duplicate_in_batch", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    expect(r.duplicate_count).toBeGreaterThan(0);
    expect(r.details.duplicates.some((d) => d.reason === "duplicate_in_batch")).toBe(true);
    const urls = r.publish_candidates.map((o) => canonicalUrl(o.source_url));
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("إعادة الفحص لا تُدرج ما هو موجود في قاعدة البيانات", async () => {
    const first = await runIngestion(GRANTED_SOURCE, { fetcher });
    const knownUrls = new Set(first.publish_candidates.map((o) => o.source_url));
    const second = await runIngestion(GRANTED_SOURCE, { fetcher, knownUrls });

    expect(second.publish_candidates).toHaveLength(0);
    expect(second.details.duplicates.some((d) => d.reason === "already_in_database")).toBe(true);
  });

  it("الرابط المرمّز وغير المرمّز ينتجان نفس المفتاح", () => {
    const raw = "https://daleelaqar.com/nav/عقارات/اربد";
    const encoded =
      "https://daleelaqar.com/nav/%D8%B9%D9%82%D8%A7%D8%B1%D8%A7%D8%AA/%D8%A7%D8%B1%D8%A8%D8%AF";
    expect(canonicalUrl(raw)).toBe(canonicalUrl(encoded));
  });

  it("اختلاف الترميز لا ينتج إعلانًا مكررًا", () => {
    const raw = "https://daleelaqar.com/nav/عقارات/اربد/حوض/أرض/للبيع/500-متر/ايدون/L1";
    const encoded = new URL(raw).href;
    const { unique, duplicates } = dedupe([{ source_url: raw }, { source_url: encoded }]);
    expect(unique).toHaveLength(1);
    expect(duplicates[0].reason).toBe("duplicate_in_batch");
  });

  it("يوحّد www والشظية والشرطة النهائية", () => {
    expect(canonicalUrl("https://www.d.com/a/")).toBe(canonicalUrl("https://d.com/a"));
    expect(canonicalUrl("https://d.com/a#x")).toBe(canonicalUrl("https://d.com/a"));
  });

  it("المتشابه يُوسم ولا يُحذف — القرار للإنسان", () => {
    const mk = (url) => ({
      source_url: url, type_category: "land", location_key: "اربد|ايدون",
      size_m2: 500, price_amount: 50000,
    });
    const { unique, suspected } = dedupe([mk("https://a/1"), mk("https://a/2")]);
    expect(unique).toHaveLength(2);
    expect(suspected).toHaveLength(1);
  });

  it("لا يطابق على بيانات ناقصة", () => {
    expect(fuzzyKey({ type_category: "land", location_key: "x" })).toBeNull();
  });
});

// ===============================================================
// الاستخراج المتدهور
// ===============================================================
describe("Degraded extraction", () => {
  const degraded = () => createFixtureFetcher(DEGRADED_PAGES);

  it("سقوط JSON-LD يرفع degraded ولا يُفشل الجولة", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher: degraded() });
    expect(r.degraded).toBe(true);
    expect(r.status).toBe(RUN_STATUS.COMPLETED);
    expect(r.details.stages.extract.strategy).toBe("links");
  });

  it("البيانات المتدهورة تمرّ بالتحقق ولا تُرفض لمجرد التدهور", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher: degraded() });
    expect(r.valid_count).toBeGreaterThan(0);
  });

  it("في الوضع المتدهور تختفي الأسعار والعناوين — كما حدث في الإنتاج", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher: degraded() });
    const all = [...r.publish_candidates, ...r.review_required];
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((o) => o.price_amount === null)).toBe(true);
    expect(all.every((o) => o.title === null)).toBe(true);
  });

  it("الصفحة الفارغة لا تنتج شيئًا ولا ترمي استثناء", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher: createFixtureFetcher(EMPTY_PAGES) });
    expect(r.status).toBe(RUN_STATUS.COMPLETED);
    expect(r.fetched_count).toBe(0);
    expect(r.publish_candidates).toHaveLength(0);
  });
});

// ===============================================================
// معالجة الأخطاء
// ===============================================================
describe("Error handling", () => {
  it("فشل الجلب يعطي status=failed مع خطأ منظّم", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher: createFixtureFetcher({}) });
    expect(r.status).toBe(RUN_STATUS.FAILED);
    expect(r.errors[0].code).toBe(ERROR_CODE.FETCH);
    expect(r.errors[0].source).toBe(GRANTED_SOURCE.source_name);
    expect(r.errors[0].message).toBeTruthy();
    expect(r.publish_candidates).toHaveLength(0);
  });

  it("عطل غير متوقع يُعزل ولا ينهار النظام", async () => {
    const broken = { fetchPage: () => { throw new TypeError("انفجار غير متوقع"); } };
    const r = await runIngestion(GRANTED_SOURCE, { fetcher: broken });
    expect(r.status).toBe(RUN_STATUS.FAILED);
    expect(r.publish_candidates).toHaveLength(0);
  });

  it("فشل مصدر لا يمنع بقية المصادر", async () => {
    const failing = {
      ...GRANTED_SOURCE, source_name: "مصدر فاشل", source_url: "https://missing.test/x",
    };
    const { reports, totals } = await runAllSources([failing, GRANTED_SOURCE], { fetcher });
    expect(reports[0].status).toBe(RUN_STATUS.FAILED);
    expect(reports[1].status).toBe(RUN_STATUS.COMPLETED);
    expect(totals.failed).toBe(1);
    expect(totals.publish_candidates).toBeGreaterThan(0);
  });
});

// ===============================================================
// التحقق من صحة البيانات
// ===============================================================
describe("Validation", () => {
  const base = normalizeOffer(
    { title: "أرض مميزة", type: "أرض", location: "إربد - ايدون", size: "500 م²",
      price: "50,000", source_url: "https://daleelaqar.com/a" },
    { sourceName: "دليل عقار" }
  );

  it("يقبل العرض الصحيح", () => {
    expect(validateOffer(base, { allowedHost: "daleelaqar.com" }).ok).toBe(true);
  });

  it("يرفض العرض بلا رابط أو نوع أو موقع", () => {
    expect(validateOffer({ ...base, source_url: "" }).reason).toBe(REJECT_REASON.NO_SOURCE_URL);
    expect(validateOffer({ ...base, type: "" }).reason).toBe(REJECT_REASON.NO_TYPE);
    expect(validateOffer({ ...base, location: "" }).reason).toBe(REJECT_REASON.NO_LOCATION);
  });

  it("يرفض المساحة غير المنطقية", () => {
    expect(validateOffer({ ...base, size_m2: 1 }).reason).toBe(REJECT_REASON.IMPLAUSIBLE_SIZE);
    expect(validateOffer({ ...base, size_m2: BOUNDS.SIZE_MAX_M2 + 1 }).reason)
      .toBe(REJECT_REASON.IMPLAUSIBLE_SIZE);
  });

  it("يقبل المساحات الكبيرة الحقيقية (28,700 م² موجودة في الإنتاج)", () => {
    expect(validateOffer({ ...base, size_m2: 28700 }).ok).toBe(true);
  });

  it("السعر غير المعقول يُطرح ويستمر العرض بلا سعر", () => {
    const r = validateOffer({ ...base, price_amount: 5, price: "5 دينار" });
    expect(r.ok).toBe(true);
    expect(r.offer.price_amount).toBeNull();
    expect(r.offer.price).toBe(NO_PRICE_TEXT);
  });

  it("يقبل سعر المتر ضمن مداه الخاص", () => {
    const r = validateOffer({
      ...base, price_amount: 4, price_unit: "per_m2", price: "4 دينار للمتر",
    });
    expect(r.ok).toBe(true);
    expect(r.offer.price_amount).toBe(4);
  });

  it("يمنع النطاق غير المسموح ومحاولات التحايل", () => {
    expect(isHostAllowed("https://www.daleelaqar.com/x", "daleelaqar.com")).toBe(true);
    expect(isHostAllowed("https://daleelaqar.com.evil.com/x", "daleelaqar.com")).toBe(false);
    expect(isHostAllowed("ليس رابطًا", "daleelaqar.com")).toBe(false);
  });
});

// ===============================================================
// درجة الجودة
// ===============================================================
describe("Quality score", () => {
  const full = normalizeOffer(
    { title: "أرض للبيع", type: "أرض", location: "إربد - ايدون", size: "500 م²",
      price: "50,000", source_url: "https://daleelaqar.com/a", listing_code: "LST1" },
    { sourceName: "س" }
  );

  it("العرض الكامل = 100 ويُنشر", () => {
    expect(scoreOffer(full).score).toBe(100);
    expect(decide(full).action).toBe("publish");
  });

  it("غياب السعر وحده لا يمنع النشر", () => {
    expect(decide({ ...full, price_amount: null, price: NO_PRICE_TEXT }).action).toBe("publish");
  });

  it("الفراغ المتعدد يذهب للمراجعة", () => {
    const poor = normalizeOffer(
      { type: "أرض", location: "إربد", size: "..", price: "..", source_url: "https://d.com/a" },
      { sourceName: "س" }
    );
    const d = decide(poor);
    expect(d.action).toBe("review");
    expect(d.score).toBeLessThan(65);
    expect(d.missing).toEqual(expect.arrayContaining(["hasTitle", "hasSize", "hasPrice"]));
  });

  it("الدرجة مفسَّرة لا ثابتة — بديل quality_score=85", () => {
    const s = scoreOffer(full);
    expect(s.breakdown).toHaveProperty("hasTitle");
    expect(Object.values(s.breakdown).reduce((a, b) => a + b, 0)).toBe(s.score);
  });

  it("العنوان يُنظَّف ولا يُختلق", () => {
    expect(normalizeTitle("  أرض للبيع  ")).toBe("أرض للبيع");
    expect(normalizeTitle("..")).toBeNull();
    expect(normalizeTitle(null)).toBeNull();
    expect(normalizeTitle("ط".repeat(300)).length).toBeLessThanOrEqual(161);
  });
});

// ===============================================================
// لا كتابة على الإنتاج
// ===============================================================
describe("لا كتابة على قاعدة البيانات", () => {
  it("الخط لا يستدعي أي عملية قاعدة بيانات", async () => {
    const db = {
      from: vi.fn(() => ({
        insert: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), select: vi.fn(),
      })),
    };
    const r = await runIngestion(GRANTED_SOURCE, { fetcher, db });
    expect(db.from).not.toHaveBeenCalled();
    expect(r.publish_candidates.length).toBeGreaterThan(0);
  });

  it("العلامة الداخلية ليست حالة قاعدة بيانات صالحة", async () => {
    // status هنا علامة قرار الخط، لا عمود external_offers.status.
    // لو نُسخت كما هي إلى قاعدة البيانات لانتهكت قيد CHECK — والكاتب
    // يمنع ذلك ببناء حمولته من قائمة أعمدة صريحة (writer.test.js).
    const r = await runIngestion(GRANTED_SOURCE, { fetcher });
    const dbStatuses = ["published", "draft", "archived", "rejected"];
    for (const o of r.publish_candidates) {
      expect(o.status).toBe("publish_candidate");
      expect(dbStatuses).not.toContain(o.status);
    }
  });
});

// ===============================================================
// سجل المصادر
// ===============================================================
describe("Source registry", () => {
  it("يطبّق الافتراضيات على الحقول الناقصة", () => {
    const c = sourceConfig({ source_name: "س", adapter: "daleelaqar" });
    expect(c.max_offers_per_run).toBe(SOURCE_DEFAULTS.max_offers_per_run);
    expect(c.max_allowed_drop_percent).toBe(SOURCE_DEFAULTS.max_allowed_drop_percent);
    expect(c.scrape_interval_minutes).toBe(SOURCE_DEFAULTS.scrape_interval_minutes);
    expect(c.enabled).toBe(false);
    expect(c.permission_status).toBe("pending");
  });

  it("يحترم القيم المصرّح بها ويتجاهل غير الصالحة", () => {
    expect(sourceConfig({ max_offers_per_run: 5 }).max_offers_per_run).toBe(5);
    expect(sourceConfig({ max_offers_per_run: -3 }).max_offers_per_run)
      .toBe(SOURCE_DEFAULTS.max_offers_per_run);
  });

  it("max_offers_per_run يحدّ المرشّحين للنشر", async () => {
    const r = await runIngestion({ ...GRANTED_SOURCE, max_offers_per_run: 1 }, { fetcher });
    expect(r.publish_candidates).toHaveLength(1);
    expect(r.review_required.some((o) => o.reason === "max_offers_per_run")).toBe(true);
  });

  it("isDueForRun يحترم فترة الفحص", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    expect(isDueForRun({ scrape_interval_minutes: 1440 }, now)).toBe(true);
    expect(isDueForRun(
      { scrape_interval_minutes: 1440, last_checked_at: "2026-08-20T11:00:00Z" }, now
    )).toBe(false);
    expect(isDueForRun(
      { scrape_interval_minutes: 60, last_checked_at: "2026-08-20T10:00:00Z" }, now
    )).toBe(true);
  });
});

// ===============================================================
// الجالب
// ===============================================================
describe("Fetcher", () => {
  it("جالب البيانات المحلية لا يلمس الشبكة", () => {
    expect(createFixtureFetcher(PAGES).kind).toBe("fixture");
  });

  it("جالب HTTP جاهز لكنه غير مستخدم في الاختبارات", () => {
    expect(createHttpFetcher().kind).toBe("http");
  });
});
