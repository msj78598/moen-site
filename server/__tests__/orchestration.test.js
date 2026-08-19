import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { searcherAgent } from "../agents/searcher.js";
import { orchestratorAgent } from "../agents/orchestrator.js";
import { publisherAgent } from "../agents/publisher.js";
import { verifierAgent } from "../agents/verifier.js";
import { LEVEL } from "../core/permissions.js";
import {
  createMemoryStore, buildReviewItem, fromPipelineReview, fromLivenessDecision,
  REVIEW_STATUS, REVIEW_KIND,
} from "../review/review-queue.js";
import { isDueForRun } from "../sources/registry.js";
import { SOURCE_SEED } from "../sources/seed.js";
import { evaluateSource } from "../ingestion/permission-gate.js";
import { getAdapter } from "../ingestion/adapters/index.js";
import { createFixtureFetcher } from "../ingestion/fetcher.js";
import { PAGES, GRANTED_SOURCE } from "../ingestion/__fixtures__/daleelaqar.js";
import { registerJob, runJob, _resetJobs } from "../scheduler/scheduler.js";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child() { return this; } };

function baseCtx(overrides = {}) {
  return {
    logger,
    audit: { record: vi.fn().mockResolvedValue(undefined) },
    dryRun: false,
    canWrite: () => true,
    fetcher: createFixtureFetcher(PAGES),
    tool: async (name) => {
      if (name === "search_external_offers") return { count: 0, rows: [] };
      throw new Error(`أداة غير متوقعة: ${name}`);
    },
    ...overrides,
  };
}

// ===============================================================
// المصادر المسجَّلة
// ===============================================================
describe("سجل المصادر", () => {
  it("كل مصدر في البذرة ممنوع التشغيل", () => {
    expect(SOURCE_SEED.length).toBeGreaterThanOrEqual(2);
    for (const source of SOURCE_SEED) {
      const v = evaluateSource(source, { hasAdapter: (n) => Boolean(getAdapter(n)) });
      expect(v.allowed, `${source.source_name} يجب أن يكون ممنوعًا`).toBe(false);
    }
  });

  it("معين عبابنه مسجَّل ومحجوب بسببين مستقلين", () => {
    const source = SOURCE_SEED.find((s) => s.source_name.includes("معين"));
    expect(source).toBeTruthy();
    expect(source.permission_status).toBe("pending");
    expect(source.enabled).toBe(false);
    // لا محوّل مُنفَّذ — الحجب مزدوج
    expect(getAdapter(source.adapter)).toBeNull();
  });

  it("لا مصدر granted في النظام", () => {
    expect(SOURCE_SEED.filter((s) => s.permission_status === "granted")).toHaveLength(0);
  });
});

// ===============================================================
// وكيل البحث
// ===============================================================
describe("وكيل البحث", () => {
  it("مستوى اقتراح ولا يملك أدوات كتابة", () => {
    expect(searcherAgent.level).toBe(LEVEL.SUGGEST);
    expect(searcherAgent.forbiddenTools).toContain("publish_external_offer");
    expect(searcherAgent.forbiddenTools).toContain("archive_external_offer");
  });

  it("لا يشغّل أي مصدر ممنوع ولا يلمس الشبكة", async () => {
    const fetchPage = vi.fn();
    const out = await searcherAgent.run(
      { sources: [...SOURCE_SEED], respectSchedule: true },
      baseCtx({ fetcher: { fetchPage } })
    );
    expect(fetchPage).not.toHaveBeenCalled();
    expect(out.counts.ran).toBe(0);
    expect(out.counts.blocked).toBe(SOURCE_SEED.length);
    expect(out.publish_candidates).toHaveLength(0);
  });

  it("يشغّل المسموح ويُخرج مرشحين", async () => {
    const out = await searcherAgent.run(
      { sources: [GRANTED_SOURCE], respectSchedule: false }, baseCtx()
    );
    expect(out.counts.ran).toBe(1);
    expect(out.publish_candidates.length).toBeGreaterThan(0);
  });

  it("يحترم الجدولة: مصدر غير مستحق لا يعمل", async () => {
    const notDue = {
      ...GRANTED_SOURCE, scrape_interval_minutes: 1440,
      last_checked_at: new Date().toISOString(),
    };
    const out = await searcherAgent.run(
      { sources: [notDue], respectSchedule: true }, baseCtx()
    );
    expect(out.counts.ran).toBe(0);
    expect(out.counts.not_due).toBe(1);
  });

  it("عزل: فشل مصدر لا يمنع الآخر", async () => {
    const failing = { ...GRANTED_SOURCE, source_name: "فاشل", source_url: "https://missing/x" };
    const out = await searcherAgent.run(
      { sources: [failing, GRANTED_SOURCE], respectSchedule: false }, baseCtx()
    );
    expect(out.reports).toHaveLength(2);
    expect(out.publish_candidates.length).toBeGreaterThan(0);
  });

  it("يحوّل review_required إلى عناصر طابور", async () => {
    const capped = { ...GRANTED_SOURCE, max_offers_per_run: 1 };
    const out = await searcherAgent.run(
      { sources: [capped], respectSchedule: false }, baseCtx()
    );
    expect(out.review_items.length).toBeGreaterThan(0);
    expect(out.review_items[0].kind).toBe(REVIEW_KIND.INGESTION);
    expect(out.review_items[0].status).toBe(REVIEW_STATUS.PENDING);
  });
});

// ===============================================================
// طابور المراجعة
// ===============================================================
describe("طابور المراجعة", () => {
  it("العنصر يحمل العقد كاملًا", () => {
    const item = buildReviewItem({
      kind: REVIEW_KIND.INGESTION, source: "س", sourceUrl: "https://d.com/a",
      reason: "quality_below_threshold", qualityScore: 40, warnings: ["hasSize"],
    });
    for (const f of ["kind", "source", "source_url", "reason", "quality_score",
      "errors", "warnings", "status", "decision_reason", "created_at",
      "last_attempt_at", "attempts"]) {
      expect(item, `${f} مفقود`).toHaveProperty(f);
    }
    expect(item.status).toBe(REVIEW_STATUS.PENDING);
  });

  it("لا يكرّر العنصر — يزيد المحاولات", async () => {
    const store = createMemoryStore();
    const item = buildReviewItem({ kind: REVIEW_KIND.INGESTION, sourceUrl: "https://d.com/a" });
    await store.add(item);
    const second = await store.add({ ...item });
    expect(second.added).toBe(false);
    expect(second.updated).toBe(true);
    expect(second.item.attempts).toBe(2);
    expect(await store.size()).toBe(1);
  });

  it("لا ترقية تلقائية إلى منشور", async () => {
    const store = createMemoryStore();
    const item = buildReviewItem({ kind: REVIEW_KIND.INGESTION, sourceUrl: "https://d.com/a" });
    await store.add(item);
    const key = store._key(item);
    expect((await store.decide(key, { status: "published" })).ok).toBe(false);
    expect((await store.decide(key, { status: REVIEW_STATUS.APPROVED })).ok).toBe(true);
  });

  it("يبني عناصر من الخط ومن التحقق", () => {
    expect(fromPipelineReview({ source_url: "https://d/1", reason: "x", quality_score: 10 }).kind)
      .toBe(REVIEW_KIND.INGESTION);
    expect(fromLivenessDecision({ source_url: "https://d/1", state: "check_failed" }).kind)
      .toBe(REVIEW_KIND.VERIFICATION);
  });
});

// ===============================================================
// الجدولة
// ===============================================================
describe("الجدولة", () => {
  it("isDueForRun يحترم الفترة", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    expect(isDueForRun({ scrape_interval_minutes: 60 }, now)).toBe(true);
    expect(isDueForRun({ scrape_interval_minutes: 60, last_checked_at: "2026-08-20T11:30:00Z" }, now)).toBe(false);
    expect(isDueForRun({ scrape_interval_minutes: 60, last_checked_at: "2026-08-20T10:00:00Z" }, now)).toBe(true);
  });

  it("قفل التشغيل المتزامن يمنع نسختين", async () => {
    _resetJobs();
    let concurrent = 0;
    let maxConcurrent = 0;
    registerJob({
      name: "slow",
      description: "اختبار القفل",
      async handler() {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 30));
        concurrent -= 1;
        return "done";
      },
    });

    const [a, b] = await Promise.all([runJob("slow", { logger }), runJob("slow", { logger })]);
    expect(maxConcurrent).toBe(1);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["skipped", "success"]);
    _resetJobs();
  });

  it("فشل المهمة يُبلَّغ ولا يرمي", async () => {
    _resetJobs();
    registerJob({
      name: "boom", description: "يفشل", maxAttempts: 1,
      handler() { throw new Error("انفجار"); },
    });
    const r = await runJob("boom", { logger });
    expect(r.status).toBe("failure");
    expect(r.error).toContain("انفجار");
    _resetJobs();
  });
});

// ===============================================================
// المنسّق
// ===============================================================
describe("المنسّق", () => {
  it("لا يملك أدوات كتابة بنفسه", () => {
    expect(orchestratorAgent.forbiddenTools).toContain("publish_external_offer");
    expect(orchestratorAgent.forbiddenTools).toContain("archive_external_offer");
    expect(orchestratorAgent.usesLLM).toBe(false);
  });

  it("لا وكيل يستخدم نموذج لغة", () => {
    for (const agent of [searcherAgent, publisherAgent, verifierAgent, orchestratorAgent]) {
      expect(agent.usesLLM, `${agent.name} يستخدم LLM`).toBe(false);
    }
  });

  it("كل وكيل بأدنى صلاحية يحتاجها", () => {
    expect(searcherAgent.level).toBe(LEVEL.SUGGEST);   // 2 — لا يكتب
    expect(verifierAgent.level).toBe(LEVEL.EXECUTE);   // 3 — status فقط
    expect(publisherAgent.level).toBe(LEVEL.PUBLISH);  // 4 — إدراج
    expect(orchestratorAgent.level).toBe(LEVEL.SUGGEST);
  });
});

// ===============================================================
// الأمان — مسارات التنفيذ لا الكلمات
// ===============================================================
describe("فحص أمني", () => {
  const root = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

  function walk(dir, acc = []) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, acc);
      else if (/\.(js|jsx)$/.test(entry)) acc.push(full);
    }
    return acc;
  }

  const srcFiles = () => walk(join(root, "src"));

  it("لا service_role في src/", () => {
    expect(srcFiles().filter((f) => /service_role/i.test(readFileSync(f, "utf8")))).toEqual([]);
  });

  it("لا استيراد لأي كود عامل من src/", () => {
    const offenders = srcFiles().filter((f) =>
      /from\s+["'].*\/server\//.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("لا كتابة على external_offers من src/", () => {
    const offenders = srcFiles().filter((f) => {
      const text = readFileSync(f, "utf8");
      return /from\(\s*["'`]external_offers["'`]\s*\)[\s\S]{0,80}\.(insert|update|upsert|delete)\(/.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it("الناشر لا يستخدم update/delete/upsert", () => {
    const text = readFileSync(join(root, "server/writers/external-offers-writer.js"), "utf8");
    expect(text).not.toMatch(/\.update\(|\.delete\(|\.upsert\(/);
  });

  it("المؤرشف لا يستخدم delete", () => {
    const text = readFileSync(join(root, "server/writers/archive-writer.js"), "utf8");
    expect(text).not.toMatch(/\.delete\(/);
    expect(text).toMatch(/\.update\(/);
  });

  it("لا Playwright ولا Puppeteer كاعتمادية", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(all).filter((k) => /playwright|puppeteer/i.test(k))).toEqual([]);
  });

  it("لا LLM في مسار الاستيعاب أو التحقق", () => {
    for (const dir of ["server/ingestion", "server/verification", "server/writers"]) {
      for (const file of walk(join(root, dir))) {
        expect(readFileSync(file, "utf8"), file)
          .not.toMatch(/ollama|openai|anthropic|\bllm\b/i);
      }
    }
  });
});
