import { describe, it, expect, vi } from "vitest";
import {
  dropPercent, evaluateRunIntegrity, assertArchiveAllowed, guardArchive,
  RUN_INTEGRITY, ArchiveBlockedError,
} from "../ingestion/archive-guard.js";
import { runIngestion, RUN_STATUS } from "../ingestion/pipeline.js";
import { createFixtureFetcher } from "../ingestion/fetcher.js";
import { PAGES, DEGRADED_PAGES, EMPTY_PAGES, GRANTED_SOURCE }
  from "../ingestion/__fixtures__/daleelaqar.js";
import { sourceConfig, SOURCE_DEFAULTS } from "../sources/registry.js";

// ===============================================================
// حساب نسبة الهبوط
// ===============================================================
describe("dropPercent", () => {
  it("يحسب الهبوط", () => {
    expect(dropPercent(40, 8)).toBe(80);
    expect(dropPercent(40, 35)).toBe(13);
    expect(dropPercent(40, 20)).toBe(50);
    expect(dropPercent(86, 8)).toBe(91);   // الحادثة الحقيقية
  });

  it("النمو والثبات ليسا هبوطًا", () => {
    expect(dropPercent(40, 40)).toBe(0);
    expect(dropPercent(40, 100)).toBe(0);
  });

  it("يعيد null عند تعذّر الحساب", () => {
    expect(dropPercent(0, 10)).toBeNull();
    expect(dropPercent(null, 10)).toBeNull();
    expect(dropPercent(40, null)).toBeNull();
    expect(dropPercent(40, -5)).toBeNull();
  });
});

// ===============================================================
// الحكم على الجولة
// ===============================================================
describe("evaluateRunIntegrity", () => {
  it("الحادثة الحقيقية: 86 ← 8 مشبوهة والأرشفة ممنوعة", () => {
    const v = evaluateRunIntegrity({
      previousCount: 86, currentCount: 8, maxAllowedDropPercent: 30,
    });
    expect(v.status).toBe(RUN_INTEGRITY.SUSPICIOUS);
    expect(v.archive_allowed).toBe(false);
    expect(v.drop_percent).toBe(91);
  });

  it("المثال المذكور: 40 ← 8 مشبوهة", () => {
    const v = evaluateRunIntegrity({
      previousCount: 40, currentCount: 8, maxAllowedDropPercent: 30,
    });
    expect(v.status).toBe(RUN_INTEGRITY.SUSPICIOUS);
    expect(v.archive_allowed).toBe(false);
  });

  it("40 ← 35 (هبوط 13%) سليمة والأرشفة مسموحة", () => {
    const v = evaluateRunIntegrity({
      previousCount: 40, currentCount: 35, maxAllowedDropPercent: 30,
    });
    expect(v.status).toBe(RUN_INTEGRITY.HEALTHY);
    expect(v.archive_allowed).toBe(true);
    expect(v.drop_percent).toBe(13);
  });

  it("الحد نفسه مسموح — المنع عند التجاوز فقط", () => {
    // 40 -> 28 = هبوط 30% بالضبط
    const atLimit = evaluateRunIntegrity({
      previousCount: 40, currentCount: 28, maxAllowedDropPercent: 30,
    });
    expect(atLimit.drop_percent).toBe(30);
    expect(atLimit.archive_allowed).toBe(true);

    // 40 -> 27 = هبوط 33%
    const over = evaluateRunIntegrity({
      previousCount: 40, currentCount: 27, maxAllowedDropPercent: 30,
    });
    expect(over.drop_percent).toBe(33);
    expect(over.archive_allowed).toBe(false);
  });

  it("الجولة الفارغة ممنوعة مهما كان الحد", () => {
    const v = evaluateRunIntegrity({
      previousCount: 40, currentCount: 0, maxAllowedDropPercent: 100,
    });
    expect(v.status).toBe(RUN_INTEGRITY.EMPTY_RUN);
    expect(v.archive_allowed).toBe(false);
  });

  it("بلا خط أساس لا أرشفة — الافتراضي هو المنع", () => {
    const v = evaluateRunIntegrity({ previousCount: null, currentCount: 10 });
    expect(v.status).toBe(RUN_INTEGRITY.NO_BASELINE);
    expect(v.archive_allowed).toBe(false);
  });

  it("أول جولة بعد صفر مسموحة — لا شيء ليُؤرشف", () => {
    const v = evaluateRunIntegrity({ previousCount: 0, currentCount: 10 });
    expect(v.status).toBe(RUN_INTEGRITY.HEALTHY);
    expect(v.archive_allowed).toBe(true);
  });

  it("النمو مسموح", () => {
    expect(evaluateRunIntegrity({ previousCount: 8, currentCount: 86 }).archive_allowed).toBe(true);
  });

  it("يحترم حدًا مخصصًا لكل مصدر", () => {
    const lenient = evaluateRunIntegrity({
      previousCount: 40, currentCount: 8, maxAllowedDropPercent: 90,
    });
    expect(lenient.archive_allowed).toBe(true);

    const strict = evaluateRunIntegrity({
      previousCount: 40, currentCount: 35, maxAllowedDropPercent: 5,
    });
    expect(strict.archive_allowed).toBe(false);
  });

  it("يعود إلى الحد الافتراضي عند غياب القيمة أو فسادها", () => {
    for (const bad of [undefined, null, NaN, -10]) {
      expect(evaluateRunIntegrity({ previousCount: 40, currentCount: 35, maxAllowedDropPercent: bad })
        .threshold).toBe(30);
    }
  });

  it("الحكم يحمل كل ما يلزم للتقرير", () => {
    const v = evaluateRunIntegrity({ previousCount: 40, currentCount: 8 });
    expect(v).toMatchObject({
      status: RUN_INTEGRITY.SUSPICIOUS,
      previous_count: 40, current_count: 8, drop_percent: 80,
      threshold: 30, archive_allowed: false, reason: RUN_INTEGRITY.SUSPICIOUS,
    });
    expect(v.message).toBeTruthy();
  });
});

// ===============================================================
// البوابة الرامية
// ===============================================================
describe("assertArchiveAllowed", () => {
  it("تمرّ عند السلامة", () => {
    expect(assertArchiveAllowed(
      evaluateRunIntegrity({ previousCount: 40, currentCount: 38 })
    )).toBe(true);
  });

  it("ترمي عند الشبهة، ورسالتها تشرح السبب بالأرقام", () => {
    const v = evaluateRunIntegrity({ previousCount: 40, currentCount: 8 });
    expect(() => assertArchiveAllowed(v)).toThrow(ArchiveBlockedError);
    try {
      assertArchiveAllowed(v);
    } catch (error) {
      expect(error.message).toContain("40");
      expect(error.message).toContain("8");
      expect(error.message).toContain("80%");
      expect(error.verdict.status).toBe(RUN_INTEGRITY.SUSPICIOUS);
    }
  });

  it("ترمي عند حكم مفقود — لا تمرير للمجهول", () => {
    expect(() => assertArchiveAllowed(undefined)).toThrow(ArchiveBlockedError);
    expect(() => assertArchiveAllowed(null)).toThrow(ArchiveBlockedError);
    expect(() => assertArchiveAllowed({})).toThrow(ArchiveBlockedError);
  });

  it("guardArchive تحسب وتحكم معًا", () => {
    expect(() => guardArchive({ previousCount: 40, currentCount: 8 })).toThrow(ArchiveBlockedError);
    expect(guardArchive({ previousCount: 40, currentCount: 38 }).archive_allowed).toBe(true);
  });
});

// ===============================================================
// التكامل مع الخط
// ===============================================================
describe("الخط يحمل حكم السلامة", () => {
  const fetcher = createFixtureFetcher(PAGES);

  it("كل جولة مكتملة تحمل run_integrity", async () => {
    const r = await runIngestion({ ...GRANTED_SOURCE, last_offer_count: 5 }, { fetcher, politeDelayMs: 0 });
    expect(r.run_integrity).toBeTruthy();
    expect(r.run_integrity).toHaveProperty("archive_allowed");
    expect(r.run_integrity).toHaveProperty("drop_percent");
  });

  it("الهبوط الكبير يجعل الجولة suspicious ويمنع الأرشفة", async () => {
    // البيانات المحلية تُنتج 5 عروض؛ خط أساس 40 يعني هبوطًا 88%
    const r = await runIngestion({ ...GRANTED_SOURCE, last_offer_count: 40 }, { fetcher, politeDelayMs: 0 });
    expect(r.status).toBe(RUN_STATUS.SUSPICIOUS);
    expect(r.run_integrity.archive_allowed).toBe(false);
  });

  it("⚠️ الأهم: الجولة المشبوهة لا تمنع نشر ما وصل فعلًا", async () => {
    const r = await runIngestion({ ...GRANTED_SOURCE, last_offer_count: 40 }, { fetcher, politeDelayMs: 0 });
    expect(r.status).toBe(RUN_STATUS.SUSPICIOUS);
    expect(r.publish_candidates.length).toBeGreaterThan(0);
    expect(r.errors).toEqual([]);
  });

  it("الهبوط المقبول يُبقي الجولة completed", async () => {
    const r = await runIngestion({ ...GRANTED_SOURCE, last_offer_count: 4 }, { fetcher, politeDelayMs: 0 });
    expect(r.status).toBe(RUN_STATUS.COMPLETED);
    expect(r.run_integrity.archive_allowed).toBe(true);
  });

  it("بلا خط أساس: الجولة completed لكن الأرشفة ممنوعة", async () => {
    const r = await runIngestion(GRANTED_SOURCE, { fetcher, politeDelayMs: 0 });
    expect(r.status).toBe(RUN_STATUS.COMPLETED);
    expect(r.run_integrity.status).toBe(RUN_INTEGRITY.NO_BASELINE);
    expect(r.run_integrity.archive_allowed).toBe(false);
  });

  it("الصفحة الفارغة: أرشفة ممنوعة", async () => {
    const r = await runIngestion(
      { ...GRANTED_SOURCE, last_offer_count: 40 },
      { fetcher: createFixtureFetcher(EMPTY_PAGES), politeDelayMs: 0 }
    );
    expect(r.run_integrity.status).toBe(RUN_INTEGRITY.EMPTY_RUN);
    expect(r.run_integrity.archive_allowed).toBe(false);
  });

  it("الاستخراج المتدهور مع خط أساس عالٍ يُرصد كجولة مشبوهة", async () => {
    // هذا هو السيناريو الحقيقي: سقوط JSON-LD -> حصيلة منهارة
    const r = await runIngestion(
      { ...GRANTED_SOURCE, last_offer_count: 86 },
      { fetcher: createFixtureFetcher(DEGRADED_PAGES), politeDelayMs: 0 }
    );
    expect(r.degraded).toBe(true);
    expect(r.status).toBe(RUN_STATUS.SUSPICIOUS);
    expect(r.run_integrity.archive_allowed).toBe(false);
  });

  it("الجولة المشبوهة تُسجَّل بمستوى error", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => logger };
    await runIngestion({ ...GRANTED_SOURCE, last_offer_count: 40 }, { fetcher, logger, politeDelayMs: 0 });
    expect(logger.error).toHaveBeenCalledWith("run_suspicious", expect.objectContaining({
      drop_percent: expect.any(Number),
    }));
  });

  it("الجولة المتخطّاة أو الفاشلة لا تحمل حكمًا — فلا أرشفة", async () => {
    const skipped = await runIngestion(
      { ...GRANTED_SOURCE, enabled: false }, { fetcher, politeDelayMs: 0 }
    );
    expect(skipped.run_integrity).toBeNull();

    const failed = await runIngestion(GRANTED_SOURCE, { fetcher: createFixtureFetcher({}) });
    expect(failed.run_integrity).toBeNull();
    // البوابة ترفض الحكم المفقود
    expect(() => assertArchiveAllowed(failed.run_integrity)).toThrow(ArchiveBlockedError);
  });
});

// ===============================================================
// الحد يأتي من سجل المصادر لا من رقم مكتوب في الكود
// ===============================================================
describe("مصدر الحد", () => {
  it("يُقرأ من صف المصدر", () => {
    expect(sourceConfig({ max_allowed_drop_percent: 15 }).max_allowed_drop_percent).toBe(15);
  });

  it("الافتراضي 30 مطابق لـ 0007_sources.sql", () => {
    expect(SOURCE_DEFAULTS.max_allowed_drop_percent).toBe(30);
    expect(sourceConfig({}).max_allowed_drop_percent).toBe(30);
  });

  it("الخط يستخدم حد المصدر لا الافتراضي", async () => {
    const fetcher = createFixtureFetcher(PAGES);
    const lenient = await runIngestion(
      { ...GRANTED_SOURCE, last_offer_count: 40, max_allowed_drop_percent: 95 }, { fetcher, politeDelayMs: 0 }
    );
    expect(lenient.run_integrity.threshold).toBe(95);
    expect(lenient.run_integrity.archive_allowed).toBe(true);
    expect(lenient.status).toBe(RUN_STATUS.COMPLETED);
  });
});
