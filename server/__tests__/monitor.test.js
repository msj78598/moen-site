import { describe, it, expect } from "vitest";
import { evaluateFreshness, evaluateArchiveRatio, daysSince } from "../agents/monitor.js";
import { redact } from "../core/logger.js";

const NOW = new Date("2026-08-19T12:00:00Z");

describe("daysSince", () => {
  it("يحسب الفارق بالأيام", () => {
    expect(daysSince("2026-08-17", NOW)).toBe(2);
    expect(daysSince("2026-08-19T00:00:00Z", NOW)).toBe(0);
  });
  it("يعيد null للتواريخ غير الصالحة", () => {
    expect(daysSince(null, NOW)).toBeNull();
    expect(daysSince("ليس تاريخًا", NOW)).toBeNull();
  });
});

describe("evaluateFreshness", () => {
  it("يعتبر العروض محدّثة خلال يومين", () => {
    expect(evaluateFreshness("2026-08-18", NOW).severity).toBe("info");
  });

  it("ينذر بعد ثلاثة أيام", () => {
    expect(evaluateFreshness("2026-08-15", NOW).severity).toBe("warning");
  });

  it("يرفع إنذارًا حرجًا بعد أسبوع — الحالة الفعلية المرصودة", () => {
    // آخر فحص حقيقي في قاعدة البيانات: 2026-07-28
    const finding = evaluateFreshness("2026-07-28", NOW);
    expect(finding.severity).toBe("critical");
    expect(finding.code).toBe("offers_stale");
    expect(finding.details.ageDays).toBe(22);
  });

  it("يعتبر غياب التواريخ حالة حرجة", () => {
    expect(evaluateFreshness(null, NOW).code).toBe("no_offer_dates");
  });
});

describe("evaluateArchiveRatio", () => {
  it("يكتشف الأرشفة الجماعية — الحالة الفعلية المرصودة (8 منشور / 78 مؤرشف)", () => {
    const finding = evaluateArchiveRatio({ published: 8, archived: 78 });
    expect(finding.severity).toBe("critical");
    expect(finding.code).toBe("mass_archive");
    expect(finding.details.archivedPct).toBe(91);
  });

  it("ينذر عند نسبة متوسطة", () => {
    expect(evaluateArchiveRatio({ published: 40, archived: 45 }).severity).toBe("warning");
  });

  it("يقبل النسبة الطبيعية", () => {
    expect(evaluateArchiveRatio({ published: 80, archived: 10 }).severity).toBe("info");
  });

  it("يعتبر الغياب التام حالة حرجة", () => {
    expect(evaluateArchiveRatio({ published: 0, archived: 0 }).code).toBe("no_offers");
  });
});

describe("redact — لا يتسرب أي سر إلى السجل", () => {
  it("يحجب المفاتيح الحساسة بالاسم", () => {
    const out = redact({ apikey: "abc", service_role_key: "xyz", name: "معين" });
    expect(out.apikey).toBe("[REDACTED]");
    expect(out.service_role_key).toBe("[REDACTED]");
    expect(out.name).toBe("معين");
  });

  it("يحجب مفاتيح Supabase داخل النصوص الحرة", () => {
    const out = redact({ msg: "failed with sb_publishable_AbCdEf123456 while calling" });
    expect(out.msg).not.toContain("sb_publishable_AbCdEf123456");
    expect(out.msg).toContain("[REDACTED]");
  });

  it("يحجب رموز JWT", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    expect(redact({ token: jwt }).token).toBe("[REDACTED]");
    expect(redact({ note: `bearer ${jwt}` }).note).toContain("[REDACTED]");
  });

  it("يتعامل مع الأخطاء والقيم المتداخلة", () => {
    const out = redact({ err: new Error("boom"), nested: { deep: { password: "p" } } });
    expect(out.err.message).toBe("boom");
    expect(out.nested.deep.password).toBe("[REDACTED]");
  });
});

describe("isMissingTable — يمنع إغراق السجل بتحذير متكرر", () => {
  it("يتعرف على صيغتي Postgres و PostgREST", async () => {
    const { isMissingTable } = await import("../core/audit.js");
    expect(isMissingTable({ code: "42P01", message: "relation does not exist" })).toBe(true);
    expect(isMissingTable({ code: "PGRST205", message: "Could not find the table 'public.audit_log' in the schema cache" })).toBe(true);
    expect(isMissingTable({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});

describe("classifyTableCheck — لا نجاح كاذب لجدول مفقود", () => {
  it("يميّز ok و missing و error", async () => {
    const { classifyTableCheck, REQUIRED_TABLES } = await import("../jobs/index.js");
    expect(classifyTableCheck(null)).toBe("ok");
    expect(classifyTableCheck({ code: "PGRST205", message: "Could not find the table 'public.leads'" })).toBe("missing");
    expect(classifyTableCheck({ code: "42501", message: "permission denied" })).toMatch(/^error: /);
    expect(REQUIRED_TABLES).toContain("leads");
    expect(REQUIRED_TABLES).toContain("audit_log");
  });
});
