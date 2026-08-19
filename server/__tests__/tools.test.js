import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";
import { defineTool, invokeTool, getTool, _resetRegistry, ToolValidationError, ToolError } from "../core/tools.js";
import { LEVEL } from "../core/permissions.js";

function makeCtx(overrides = {}) {
  return {
    agent: { name: "test-agent", level: LEVEL.EXECUTE, allowedTools: ["echo", "writer"], forbiddenTools: [] },
    audit: { record: vi.fn().mockResolvedValue(undefined) },
    logger: { warn: vi.fn(), info: vi.fn(), child: () => ({ warn: vi.fn(), info: vi.fn() }) },
    dryRun: false,
    ...overrides,
  };
}

beforeEach(() => {
  _resetRegistry();
  defineTool({
    name: "echo", description: "يعيد ما يصله", level: LEVEL.READ, capability: "read_test",
    input: z.object({ value: z.string() }),
    output: z.object({ value: z.string() }),
    handler: async ({ value }) => ({ value }),
  });
  defineTool({
    name: "writer", description: "أداة كاتبة", level: LEVEL.EXECUTE, capability: "write_test",
    writes: true,
    input: z.object({ id: z.string() }),
    output: z.object({ updated: z.boolean() }),
    handler: async () => ({ updated: true }),
  });
});

describe("defineTool", () => {
  it("يرفض التعريف الناقص", () => {
    expect(() => defineTool({ name: "x" })).toThrow(/ناقص/);
  });

  it("يرفض تعريف أداة مكررة", () => {
    expect(() => defineTool({
      name: "echo", description: "d", level: 1, capability: "c",
      input: z.object({}), output: z.object({}), handler: async () => ({}),
    })).toThrow(/معرّفة مسبقًا/);
  });
});

describe("getTool", () => {
  it("يرفض أي أداة غير معرّفة — لا تنفيذ لعمليات مجهولة", () => {
    expect(() => getTool("drop_everything")).toThrow(/أداة غير معروفة/);
  });
});

describe("invokeTool", () => {
  it("ينفّذ ويتحقق ويسجّل عند النجاح", async () => {
    const ctx = makeCtx();
    const result = await invokeTool("echo", { value: "مرحبا" }, ctx);
    expect(result).toEqual({ value: "مرحبا" });
    expect(ctx.audit.record).toHaveBeenCalledWith(expect.objectContaining({ status: "success", action: "echo" }));
  });

  it("يرفض المدخلات غير الصالحة قبل التنفيذ", async () => {
    const ctx = makeCtx();
    await expect(invokeTool("echo", { value: 123 }, ctx)).rejects.toBeInstanceOf(ToolValidationError);
    expect(ctx.audit.record).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
  });

  it("يرفض المخرجات غير المطابقة للمخطط", async () => {
    _resetRegistry();
    defineTool({
      name: "echo", description: "d", level: LEVEL.READ, capability: "c",
      input: z.object({}), output: z.object({ must: z.string() }),
      handler: async () => ({ wrong: true }),
    });
    const ctx = makeCtx({ agent: { name: "a", level: LEVEL.READ, allowedTools: ["echo"], forbiddenTools: [] } });
    await expect(invokeTool("echo", {}, ctx)).rejects.toThrow(/مخرجات غير صالحة/);
  });

  it("يمنع أداة تتجاوز صلاحية الوكيل", async () => {
    const ctx = makeCtx({ agent: { name: "reader", level: LEVEL.READ, allowedTools: ["writer"], forbiddenTools: [] } });
    await expect(invokeTool("writer", { id: "1" }, ctx)).rejects.toThrow(/تتطلب مستوى/);
  });

  it("لا ينفّذ الأدوات الكاتبة في وضع dry-run", async () => {
    const ctx = makeCtx({ dryRun: true });
    const result = await invokeTool("writer", { id: "1" }, ctx);
    expect(result).toEqual({ dryRun: true, skipped: true });
    expect(ctx.audit.record).toHaveBeenCalledWith(expect.objectContaining({ status: "skipped_dry_run" }));
  });

  it("ينفّذ أدوات القراءة عادةً في وضع dry-run", async () => {
    const ctx = makeCtx({ dryRun: true });
    await expect(invokeTool("echo", { value: "ok" }, ctx)).resolves.toEqual({ value: "ok" });
  });

  it("يرمي ToolError لأي أداة مجهولة", async () => {
    await expect(invokeTool("nope", {}, makeCtx())).rejects.toBeInstanceOf(ToolError);
  });
});
