import { describe, it, expect, vi } from "vitest";
import {
  classifyProbe, decideLiveness, checkOffer, LIVENESS, REQUIRED_CONFIRMATIONS,
} from "../verification/liveness.js";
import {
  archiveDecided, ARCHIVE_REJECT, MAX_BATCH_ARCHIVE_PERCENT,
} from "../writers/archive-writer.js";
import { verifierAgent } from "../agents/verifier.js";
import { invokeTool } from "../core/tools.js";
import { LEVEL } from "../core/permissions.js";
import { evaluateRunIntegrity } from "../ingestion/archive-guard.js";

const ok = (status = 200, body = "") => ({ ok: true, status, error: null, body });
const bad = (status) => ({ ok: false, status, error: null });
const netFail = (error = "timeout") => ({ ok: false, status: null, error });

// ===============================================================
// تصنيف الفحص الواحد
// ===============================================================
describe("classifyProbe", () => {
  it("الاستجابة السليمة = حي", () => {
    expect(classifyProbe(ok(200)).state).toBe(LIVENESS.ACTIVE);
  });

  it("404 و 410 = منتهٍ", () => {
    expect(classifyProbe(bad(404)).state).toBe(LIVENESS.EXPIRED);
    expect(classifyProbe(bad(410)).state).toBe(LIVENESS.EXPIRED);
  });

  it("⚠️ الأهم: العطل المؤقت ليس انتهاءً", () => {
    for (const code of [408, 429, 500, 502, 503, 504]) {
      expect(classifyProbe(bad(code)).state).toBe(LIVENESS.CHECK_FAILED);
    }
  });

  it("انقطاع الشبكة والمهلة = تعذّر التحقق لا انتهاء", () => {
    expect(classifyProbe(netFail("timeout")).state).toBe(LIVENESS.CHECK_FAILED);
    expect(classifyProbe(netFail("ECONNRESET")).state).toBe(LIVENESS.CHECK_FAILED);
    expect(classifyProbe(null).state).toBe(LIVENESS.CHECK_FAILED);
  });

  it("401/403 تذهب للمراجعة لا للأرشفة", () => {
    expect(classifyProbe(bad(401)).state).toBe(LIVENESS.REVIEW_REQUIRED);
    expect(classifyProbe(bad(403)).state).toBe(LIVENESS.REVIEW_REQUIRED);
  });

  it("نص الصفحة يكشف الانتهاء", () => {
    expect(classifyProbe(ok(200, "<p>انتهى الإعلان</p>")).state).toBe(LIVENESS.UNAVAILABLE);
    expect(classifyProbe(ok(200, "listing expired")).state).toBe(LIVENESS.UNAVAILABLE);
  });
});

// ===============================================================
// القرار المجمّع
// ===============================================================
describe("decideLiveness", () => {
  it("إشارة حياة واحدة تكفي لإبقاء الإعلان", () => {
    const d = decideLiveness([bad(404), ok(200)]);
    expect(d.state).toBe(LIVENESS.ACTIVE);
    expect(d.archivable).toBe(false);
  });

  it("404 مؤكَّد مرتين يسمح بالأرشفة", () => {
    const d = decideLiveness([bad(404), bad(404)]);
    expect(d.state).toBe(LIVENESS.EXPIRED);
    expect(d.archivable).toBe(true);
    expect(d.confirmations).toBe(2);
  });

  it("⚠️ 404 مرة واحدة لا يكفي — يذهب للمراجعة", () => {
    const d = decideLiveness([bad(404), netFail()]);
    expect(d.state).toBe(LIVENESS.REVIEW_REQUIRED);
    expect(d.archivable).toBe(false);
    expect(d.reason).toBe("unconfirmed_expired");
  });

  it("فشل الشبكة المتكرر لا يؤرشف شيئًا", () => {
    const d = decideLiveness([netFail(), netFail(), netFail()]);
    expect(d.state).toBe(LIVENESS.CHECK_FAILED);
    expect(d.archivable).toBe(false);
  });

  it("بلا محاولات = لا قرار ولا أرشفة", () => {
    expect(decideLiveness([]).archivable).toBe(false);
    expect(decideLiveness(null).archivable).toBe(false);
  });

  it("عدد التأكيدات قابل للضبط", () => {
    expect(decideLiveness([bad(404)], { requiredConfirmations: 1 }).archivable).toBe(true);
    expect(REQUIRED_CONFIRMATIONS).toBe(2);
  });
});

// ===============================================================
// checkOffer
// ===============================================================
describe("checkOffer", () => {
  it("يتوقف مبكرًا عند إشارة حياة", async () => {
    const probe = vi.fn().mockResolvedValue(ok(200));
    const r = await checkOffer({ source_url: "https://x/1" }, { probe, attempts: 3 });
    expect(probe).toHaveBeenCalledTimes(1);
    expect(r.state).toBe(LIVENESS.ACTIVE);
  });

  it("يعيد المحاولة عند الفشل ولا يؤرشف", async () => {
    const probe = vi.fn().mockResolvedValue(netFail());
    const r = await checkOffer({ source_url: "https://x/1" }, { probe, attempts: 2 });
    expect(probe).toHaveBeenCalledTimes(2);
    expect(r.archivable).toBe(false);
  });

  it("استثناء الجالب يُعزل ولا يُسقط الفحص", async () => {
    const probe = vi.fn().mockRejectedValue(new Error("انفجار"));
    const r = await checkOffer({ source_url: "https://x/1" }, { probe, attempts: 2 });
    expect(r.state).toBe(LIVENESS.CHECK_FAILED);
  });
});

// ===============================================================
// بوابات الأرشفة
// ===============================================================
function fakeDb({ updateError = null, updated = true } = {}) {
  const updates = [];
  return {
    _updates: updates,
    from: vi.fn(() => ({
      update: vi.fn((row) => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => {
                if (updateError) return { data: null, error: updateError };
                if (!updated) return { data: null, error: null };
                updates.push(row);
                return { data: { id: "x" }, error: null };
              },
            }),
          }),
        }),
      })),
    })),
  };
}

const ctxFor = (db, overrides = {}) => ({
  agent: verifierAgent, db,
  audit: { record: vi.fn().mockResolvedValue(undefined) },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child() { return this; } },
  dryRun: false, canWrite: () => true, ...overrides,
});

const expired = (url) => ({
  source_url: url, state: LIVENESS.EXPIRED, archivable: true, reason: "http_404",
});

describe("بوابات الأرشفة", () => {
  it("الجولة المشبوهة تمنع كل الأرشفة", async () => {
    const db = fakeDb();
    const r = await archiveDecided([expired("https://a/1")], ctxFor(db), {
      runIntegrity: evaluateRunIntegrity({ previousCount: 40, currentCount: 8 }),
      publishedCount: 40,
    });
    expect(r.blocked).toBe(true);
    expect(r.counts.archived).toBe(0);
    expect(db._updates).toHaveLength(0);
    expect(r.skipped[0].reason).toBe(ARCHIVE_REJECT.RUN_SUSPICIOUS);
  });

  it("الحكم المفقود يمنع الأرشفة", async () => {
    const db = fakeDb();
    const r = await archiveDecided([expired("https://a/1")], ctxFor(db), {
      runIntegrity: null, publishedCount: 10,
    });
    expect(r.blocked).toBe(true);
    expect(db._updates).toHaveLength(0);
  });

  it("سقف الدفعة يمنع أرشفة نسبة كبيرة دفعة واحدة", async () => {
    const db = fakeDb();
    const many = Array.from({ length: 9 }, (_, i) => expired(`https://a/${i}`));
    const r = await archiveDecided(many, ctxFor(db), {
      runIntegrity: evaluateRunIntegrity({ previousCount: 10, currentCount: 10 }),
      publishedCount: 10, // السقف = 20% = 2
    });
    expect(r.blocked).toBe(true);
    expect(r.blocked_reason).toBe(ARCHIVE_REJECT.BATCH_LIMIT);
    expect(db._updates).toHaveLength(0);
  });

  it("الجولة السليمة ضمن السقف تؤرشف فعلًا", async () => {
    const db = fakeDb();
    const r = await archiveDecided([expired("https://a/1")], ctxFor(db), {
      runIntegrity: evaluateRunIntegrity({ previousCount: 20, currentCount: 20 }),
      publishedCount: 20,
    });
    expect(r.blocked).toBe(false);
    expect(r.counts.archived).toBe(1);
    expect(db._updates[0].status).toBe("archived");
  });

  it("الحالة غير القاطعة لا تُؤرشف", async () => {
    const db = fakeDb();
    const decisions = [
      { source_url: "https://a/1", state: LIVENESS.CHECK_FAILED, archivable: false },
      { source_url: "https://a/2", state: LIVENESS.ACTIVE, archivable: false },
      { source_url: "https://a/3", state: LIVENESS.REVIEW_REQUIRED, archivable: false },
    ];
    const r = await archiveDecided(decisions, ctxFor(db), {
      runIntegrity: evaluateRunIntegrity({ previousCount: 10, currentCount: 10 }),
      publishedCount: 10,
    });
    expect(r.counts.archived).toBe(0);
    expect(db._updates).toHaveLength(0);
  });

  it("رفض RLS (صفر صفوف) لا يُحسب أرشفة", async () => {
    const db = fakeDb({ updated: false });
    const r = await archiveDecided([expired("https://a/1")], ctxFor(db), {
      runIntegrity: evaluateRunIntegrity({ previousCount: 20, currentCount: 20 }),
      publishedCount: 20,
    });
    expect(r.counts.archived).toBe(0);
    expect(r.skipped[0].reason).toBe(ARCHIVE_REJECT.NOT_FOUND);
  });

  it("dry-run لا يؤرشف", async () => {
    const db = fakeDb();
    const r = await archiveDecided([expired("https://a/1")], ctxFor(db, { dryRun: true }), {
      runIntegrity: evaluateRunIntegrity({ previousCount: 20, currentCount: 20 }),
      publishedCount: 20,
    });
    expect(r.counts.archived).toBe(0);
    expect(db._updates).toHaveLength(0);
  });

  it("بلا service_role لا أرشفة", async () => {
    const db = fakeDb();
    const r = await archiveDecided([expired("https://a/1")], ctxFor(db, { canWrite: () => false }), {
      runIntegrity: evaluateRunIntegrity({ previousCount: 20, currentCount: 20 }),
      publishedCount: 20,
    });
    expect(r.counts.archived).toBe(0);
    expect(db._updates).toHaveLength(0);
  });

  it("السقف ثابت 20%", () => {
    expect(MAX_BATCH_ARCHIVE_PERCENT).toBe(20);
  });
});

// ===============================================================
// أداة الأرشفة
// ===============================================================
describe("أداة archive_external_offer", () => {
  it("ترفض المستدعي المجهول", async () => {
    await expect(invokeTool("archive_external_offer", {
      source_url: "https://a/1", liveness_state: LIVENESS.EXPIRED, reason: "x",
    }, { db: fakeDb(), agent: null })).rejects.toThrow();
  });

  it("ترفض وكيلًا بمستوى أدنى", async () => {
    const reader = {
      name: "monitor", level: LEVEL.READ,
      allowedTools: ["archive_external_offer"], forbiddenTools: [],
    };
    await expect(invokeTool("archive_external_offer", {
      source_url: "https://a/1", liveness_state: LIVENESS.EXPIRED, reason: "x",
    }, { db: fakeDb(), agent: reader, canWrite: () => true })).rejects.toThrow(/تتطلب مستوى/);
  });

  it("ترفض الأرشفة على حالة حياة غير قاطعة", async () => {
    const db = fakeDb();
    const r = await invokeTool("archive_external_offer", {
      source_url: "https://a/1", liveness_state: LIVENESS.CHECK_FAILED, reason: "timeout",
    }, ctxFor(db));
    expect(r.archived).toBe(false);
    expect(r.reason).toBe(ARCHIVE_REJECT.NOT_ARCHIVABLE);
  });
});

// ===============================================================
// وكيل التحقق
// ===============================================================
describe("وكيل التحقق", () => {
  it("لا يملك أداة النشر", () => {
    expect(verifierAgent.allowedTools).not.toContain("publish_external_offer");
    expect(verifierAgent.forbiddenTools).toContain("publish_external_offer");
    expect(verifierAgent.level).toBe(LEVEL.EXECUTE);
  });

  it("العروض الحية تبقى ولا تُؤرشف", async () => {
    const db = fakeDb();
    const ctx = {
      ...ctxFor(db),
      tool: async (name, args) => {
        if (name === "search_external_offers") {
          return { count: 2, rows: [
            { id: "1", source_url: "https://daleelaqar.com/a" },
            { id: "2", source_url: "https://daleelaqar.com/b" },
          ] };
        }
        if (name === "check_url_liveness") return { url: args.url, ok: true, status: 200, error: null };
        throw new Error(`أداة غير متوقعة: ${name}`);
      },
    };
    const out = await verifierAgent.run({ limit: 50, attempts: 2, maxAllowedDropPercent: 30 }, ctx);
    expect(out.checked).toBe(2);
    expect(out.active).toBe(2);
    expect(out.archived).toHaveLength(0);
    expect(db._updates).toHaveLength(0);
  });

  it("⚠️ انهيار الشبكة الجماعي لا يؤرشف شيئًا ويملأ طابور المراجعة", async () => {
    const db = fakeDb();
    const ctx = {
      ...ctxFor(db),
      tool: async (name) => {
        if (name === "search_external_offers") {
          return { count: 3, rows: [1, 2, 3].map((i) => ({ id: String(i), source_url: `https://d.com/${i}` })) };
        }
        throw new Error("network down");
      },
    };
    const out = await verifierAgent.run({ limit: 50, attempts: 2, maxAllowedDropPercent: 30 }, ctx);
    expect(out.archived).toHaveLength(0);
    expect(db._updates).toHaveLength(0);
    expect(out.review_items.length).toBe(3);
  });
});
