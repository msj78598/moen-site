import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  buildRow, screenCandidate, publishCandidates,
  WRITE_REJECT, NO_SIZE_TEXT,
} from "../writers/external-offers-writer.js";
import { publisherAgent } from "../agents/publisher.js";
import { runAgent } from "../core/agent.js";
import { invokeTool } from "../core/tools.js";
import { LEVEL } from "../core/permissions.js";
import { runIngestion, CANDIDATE_STATUS } from "../ingestion/pipeline.js";
import { createFixtureFetcher } from "../ingestion/fetcher.js";
import { PAGES, GRANTED_SOURCE } from "../ingestion/__fixtures__/daleelaqar.js";
import { canonicalUrl } from "../ingestion/dedupe.js";

// ===============================================================
// أدوات مساعدة — قاعدة بيانات مزيّفة، لا اتصال بأي شيء حقيقي
// ===============================================================

function fakeDb({ existingUrls = [], insertError = null, lookupError = null } = {}) {
  const inserted = [];
  const db = {
    from: vi.fn((table) => ({
      // select() يجب أن يكون قابلًا للانتظار مباشرةً (قراءة كل الروابط)
      // وقابلًا للسلسلة عبر .eq().maybeSingle() (فحص التكرار).
      select: vi.fn(() => {
        const rows = existingUrls.map((u) => ({ source_url: u, id: "x" }));
        const pending = Promise.resolve({ data: rows, error: null });
        pending.eq = (_col, value) => ({
          maybeSingle: async () => ({
            data: lookupError
              ? null
              : existingUrls.some((u) => canonicalUrl(u) === value) ? { id: "existing" } : null,
            error: lookupError,
          }),
        });
        return pending;
      }),
      insert: vi.fn(async (row) => {
        if (insertError) return { error: insertError };
        inserted.push({ table, row });
        return { error: null };
      }),
    })),
    _inserted: inserted,
  };
  return db;
}

function makeCtx(db, overrides = {}) {
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => logger };
  return {
    agent: publisherAgent, db, audit, logger, dryRun: false,
    canWrite: () => true,   // تُحقن؛ اختبار مخصص أدناه يثبت الحارس بالعكس
    ...overrides,
  };
}

/** يجلب مرشحًا حقيقيًا من الخط ببيانات محلية — بلا شبكة. */
async function realCandidate() {
  const r = await runIngestion(GRANTED_SOURCE, { fetcher: createFixtureFetcher(PAGES), politeDelayMs: 0 });
  return r.publish_candidates[0];
}

// ===============================================================
// 1 — المرشح الصالح يتحول إلى صف
// ===============================================================
describe("المرشح الصالح", () => {
  it("الخط ينتج مرشحًا بعلامة publish_candidate", async () => {
    const c = await realCandidate();
    expect(c.status).toBe(CANDIDATE_STATUS.PUBLISH);
  });

  it("يجتاز الفحص", async () => {
    const c = await realCandidate();
    expect(screenCandidate(c, { allowedHost: "daleelaqar.com" }).ok).toBe(true);
  });

  it("يُدرج فعلًا في external_offers", async () => {
    const db = fakeDb();
    const c = await realCandidate();
    const res = await publishCandidates([c], makeCtx(db), { allowedHost: "daleelaqar.com" });

    expect(res.counts.written).toBe(1);
    expect(db._inserted).toHaveLength(1);
    expect(db._inserted[0].table).toBe("external_offers");
  });
});

// ===============================================================
// الحمولة — القائمة البيضاء
// ===============================================================
describe("buildRow", () => {
  it("لا يسرّب علامة الخط الداخلية إلى قاعدة البيانات", async () => {
    const c = await realCandidate();
    const row = buildRow(c);
    expect(row.status).toBe("published");
    expect(row.status).not.toBe(CANDIDATE_STATUS.PUBLISH);
  });

  it("لا يكتب إلا الأعمدة الموجودة فعلًا في الجدول", async () => {
    const c = await realCandidate();
    const row = buildRow(c);
    const allowed = ["type", "location", "size", "price", "note",
      "source_name", "source_url", "checked_at", "status", "quality_score"];
    expect(Object.keys(row).sort()).toEqual([...allowed].sort());
  });

  it("يستبعد الحقول المحسوبة التي لا عمود لها", async () => {
    const c = await realCandidate();
    const row = buildRow(c);
    for (const gone of ["title", "type_category", "size_m2", "price_amount",
      "price_currency", "price_unit", "listing_code", "location_key",
      "quality_breakdown", "missing_fields", "raw"]) {
      expect(row).not.toHaveProperty(gone);
    }
  });

  it("يوحّد الرابط قبل الكتابة", () => {
    const row = buildRow({
      status: CANDIDATE_STATUS.PUBLISH, type: "أرض", location: "إربد",
      price: "1", size: "1 م²", source_name: "س", checked_at: "2026-08-20",
      quality_score: 90, source_url: "https://WWW.daleelaqar.com/a/",
    });
    expect(row.source_url).toBe(canonicalUrl("https://daleelaqar.com/a"));
  });

  it("المساحة الغائبة تصبح نصًا صريحًا لا فراغًا ولا رقمًا مخترعًا", () => {
    const row = buildRow({
      status: CANDIDATE_STATUS.PUBLISH, type: "أرض", location: "إربد",
      price: "1", size: "", source_name: "س", checked_at: "2026-08-20",
      quality_score: 90, source_url: "https://daleelaqar.com/a",
    });
    expect(row.size).toBe(NO_SIZE_TEXT);
  });
});

// ===============================================================
// 2 · 3 — الرفض
// ===============================================================
describe("الرفض", () => {
  it("المرشح غير الصالح يُرفض ولا يُكتب", async () => {
    const db = fakeDb();
    const bad = { status: CANDIDATE_STATUS.PUBLISH, type: "أ" }; // ناقص
    const res = await publishCandidates([bad], makeCtx(db));

    expect(res.counts.written).toBe(0);
    expect(res.skipped[0].reason).toBe(WRITE_REJECT.INVALID);
    expect(db._inserted).toHaveLength(0);
  });

  it("المرشح بحالة غير publish_candidate يُرفض", async () => {
    const db = fakeDb();
    const c = await realCandidate();

    for (const status of [CANDIDATE_STATUS.REVIEW, "published", "draft", undefined, null]) {
      const res = await publishCandidates([{ ...c, status }], makeCtx(db),
        { allowedHost: "daleelaqar.com" });
      expect(res.counts.written).toBe(0);
      expect(res.skipped[0].reason).toBe(WRITE_REJECT.NOT_CANDIDATE);
    }
    expect(db._inserted).toHaveLength(0);
  });

  it("رابط من نطاق غير مسموح يُرفض", async () => {
    const db = fakeDb();
    const c = await realCandidate();
    const res = await publishCandidates(
      [{ ...c, source_url: "https://evil.example.com/x" }],
      makeCtx(db), { allowedHost: "daleelaqar.com" }
    );
    expect(res.counts.written).toBe(0);
    expect(db._inserted).toHaveLength(0);
  });

  it("بلا service_role لا كتابة إطلاقًا", async () => {
    const db = fakeDb();
    const c = await realCandidate();
    const res = await publishCandidates(
      [c], makeCtx(db, { canWrite: () => false }), { allowedHost: "daleelaqar.com" }
    );

    expect(res.counts.written).toBe(0);
    expect(res.skipped[0].reason).toBe(WRITE_REJECT.NO_WRITE_CREDENTIALS);
    expect(db._inserted).toHaveLength(0);
  });

  it("الحارس الافتراضي هو canWrite الحقيقية عند غياب الحقن", async () => {
    const db = fakeDb();
    const c = await realCandidate();
    // بلا canWrite في السياق -> يعود إلى القراءة من الإعدادات،
    // ولا يوجد service_role في بيئة الاختبار -> يُرفض.
    const ctx = makeCtx(db);
    delete ctx.canWrite;
    const res = await publishCandidates([c], ctx, { allowedHost: "daleelaqar.com" });

    expect(res.counts.written).toBe(0);
    expect(res.skipped[0].reason).toBe(WRITE_REJECT.NO_WRITE_CREDENTIALS);
  });
});

// ===============================================================
// 4 — التكرار
// ===============================================================
describe("منع التكرار", () => {
  it("الرابط الموجود مسبقًا لا يُدرج مرة أخرى", async () => {
    const c = await realCandidate();
    const db = fakeDb({ existingUrls: [c.source_url] });
    const res = await publishCandidates([c], makeCtx(db), { allowedHost: "daleelaqar.com" });

    expect(res.counts.written).toBe(0);
    expect(res.skipped[0].reason).toBe(WRITE_REJECT.DUPLICATE);
    expect(db._inserted).toHaveLength(0);
  });

  it("اختلاف الترميز لا يتجاوز فحص التكرار", async () => {
    const c = await realCandidate();
    const decoded = decodeURIComponent(c.source_url);
    const db = fakeDb({ existingUrls: [decoded] });
    const res = await publishCandidates([c], makeCtx(db), { allowedHost: "daleelaqar.com" });

    expect(res.counts.written).toBe(0);
    expect(res.skipped[0].reason).toBe(WRITE_REJECT.DUPLICATE);
  });

  it("نفس المرشح مرتين في الدفعة يُكتب مرة واحدة", async () => {
    const db = fakeDb();
    const c = await realCandidate();
    const res = await publishCandidates([c, c], makeCtx(db), { allowedHost: "daleelaqar.com" });

    expect(res.counts.written).toBe(1);
    expect(res.counts.skipped).toBe(1);
    expect(db._inserted).toHaveLength(1);
  });

  it("سباق الكتابة (23505) يُعامل كتكرار لا كفشل", async () => {
    const db = fakeDb({ insertError: { code: "23505", message: "duplicate key" } });
    const c = await realCandidate();
    const res = await publishCandidates([c], makeCtx(db), { allowedHost: "daleelaqar.com" });

    expect(res.counts.written).toBe(0);
    expect(res.counts.failed).toBe(0);
    expect(res.skipped[0].reason).toBe(WRITE_REJECT.DUPLICATE);
  });
});

// ===============================================================
// 7 — الفشل ليس نجاحًا
// ===============================================================
describe("الفشل", () => {
  it("خطأ قاعدة البيانات لا يُحسب نجاحًا", async () => {
    const db = fakeDb({ insertError: { code: "42501", message: "permission denied" } });
    const c = await realCandidate();
    const res = await publishCandidates([c], makeCtx(db), { allowedHost: "daleelaqar.com" });

    expect(res.counts.written).toBe(0);
    expect(res.counts.failed).toBe(1);
    expect(res.failed[0].error).toContain("permission denied");
  });

  it("فشل عرض لا يمنع الباقي", async () => {
    const db = fakeDb();
    const c = await realCandidate();
    const bad = { status: CANDIDATE_STATUS.PUBLISH, type: "x" };
    const res = await publishCandidates([bad, c], makeCtx(db), { allowedHost: "daleelaqar.com" });

    expect(res.counts.written).toBe(1);
    expect(res.counts.skipped).toBe(1);
  });
});

// ===============================================================
// 6 — لا مستدعٍ مجهول
// ===============================================================
describe("منع المستدعي المجهول", () => {
  it("النداء بلا هوية وكيل يفشل", async () => {
    const db = fakeDb();
    const c = await realCandidate();
    await expect(
      invokeTool("publish_external_offer", { candidate: c }, { db, agent: null, canWrite: () => true })
    ).rejects.toThrow();
  });

  it("وكيل بمستوى أدنى لا يستطيع النشر", async () => {
    const db = fakeDb();
    const c = await realCandidate();
    const reader = {
      name: "monitor", level: LEVEL.READ,
      allowedTools: ["publish_external_offer"], forbiddenTools: [],
    };
    await expect(
      invokeTool("publish_external_offer", { candidate: c }, { db, agent: reader, canWrite: () => true })
    ).rejects.toThrow(/تتطلب مستوى/);
  });

  it("وكيل لا يملك الأداة ضمن أدواته يُرفض", async () => {
    const db = fakeDb();
    const c = await realCandidate();
    const other = {
      name: "x", level: LEVEL.PUBLISH, allowedTools: ["search_properties"], forbiddenTools: [],
    };
    await expect(
      invokeTool("publish_external_offer", { candidate: c }, { db, agent: other, canWrite: () => true })
    ).rejects.toThrow(/ليست ضمن الأدوات المسموحة/);
  });

  it("وضع dry-run لا يكتب شيئًا", async () => {
    const db = fakeDb();
    const c = await realCandidate();
    const res = await publishCandidates([c], makeCtx(db, { dryRun: true }),
      { allowedHost: "daleelaqar.com" });

    expect(res.counts.written).toBe(0);
    expect(db._inserted).toHaveLength(0);
  });
});

// ===============================================================
// 8 — التدقيق
// ===============================================================
describe("التدقيق", () => {
  it("النجاح يُسجَّل", async () => {
    const db = fakeDb();
    const ctx = makeCtx(db);
    await publishCandidates([await realCandidate()], ctx, { allowedHost: "daleelaqar.com" });

    expect(ctx.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "publish_external_offer", status: "success" })
    );
  });

  it("الفشل يُسجَّل كـ failure", async () => {
    const db = fakeDb({ insertError: { code: "42501", message: "permission denied" } });
    const ctx = makeCtx(db);
    await publishCandidates([await realCandidate()], ctx, { allowedHost: "daleelaqar.com" });

    expect(ctx.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "publish_external_offer", status: "failure" })
    );
  });

  it("dry-run يُسجَّل ولا يُبتلع", async () => {
    const db = fakeDb();
    const ctx = makeCtx(db, { dryRun: true });
    await publishCandidates([await realCandidate()], ctx, { allowedHost: "daleelaqar.com" });

    expect(ctx.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ status: "skipped_dry_run" })
    );
  });
});

// ===============================================================
// الوكيل
// ===============================================================
describe("وكيل النشر", () => {
  it("يملك أداة واحدة فقط وبمستوى النشر", () => {
    expect(publisherAgent.level).toBe(LEVEL.PUBLISH);
    expect(publisherAgent.allowedTools).toEqual(["publish_external_offer"]);
    expect(publisherAgent.usesLLM).toBe(false);
  });

  it("يعمل من طرف إلى طرف على بيانات محلية", async () => {
    const db = fakeDb();
    const r = await runIngestion(GRANTED_SOURCE, { fetcher: createFixtureFetcher(PAGES), politeDelayMs: 0 });
    const out = await runAgent(
      publisherAgent,
      { candidates: r.publish_candidates, allowedHost: "daleelaqar.com" },
      makeCtx(db)
    );

    expect(out.counts.written).toBe(r.publish_candidates.length);
    expect(db._inserted).toHaveLength(r.publish_candidates.length);
    for (const { row } of db._inserted) {
      expect(row.status).toBe("published");
      expect(row.source_name).toBeTruthy();
      expect(row.source_url).toBeTruthy();
    }
  });
});

// ===============================================================
// 5 — إثباتات أمنية على شجرة الملفات
// ===============================================================
describe("إثباتات أمنية", () => {
  const root = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

  function walk(dir, acc = []) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, acc);
      else if (/\.(js|jsx)$/.test(entry)) acc.push(full);
    }
    return acc;
  }

  it("لا وجود لـ service_role داخل src/", () => {
    const offenders = walk(join(root, "src"))
      .filter((f) => /service_role/i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("الكاتب لا يستورد أي شيء من src/", () => {
    const src = readFileSync(join(root, "server", "writers", "external-offers-writer.js"), "utf8");
    expect(src).not.toMatch(/from\s+["'].*\/src\//);
  });

  it("الكاتب يستخدم قاعدة البيانات من السياق فقط ولا ينشئ عميلًا بنفسه", () => {
    const src = readFileSync(join(root, "server", "writers", "external-offers-writer.js"), "utf8");
    expect(src).not.toMatch(/createClient/);
    expect(src).toMatch(/canWrite/);
  });

  it("الكاتب لا يُنفّذ UPDATE أو DELETE — إدراج فقط", () => {
    const src = readFileSync(join(root, "server", "writers", "external-offers-writer.js"), "utf8");
    expect(src).not.toMatch(/\.update\(|\.delete\(|\.upsert\(/);
    expect(src).toMatch(/\.insert\(/);
  });

  it("لا استدعاء شبكة داخل الكاتب — لا scraping", () => {
    const src = readFileSync(join(root, "server", "writers", "external-offers-writer.js"), "utf8");
    expect(src).not.toMatch(/\bfetch\(|axios|playwright|puppeteer/i);
  });
});
