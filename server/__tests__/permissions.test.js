import { describe, it, expect } from "vitest";
import { assertAllowed, PermissionError, LEVEL, FORBIDDEN_ALWAYS } from "../core/permissions.js";

const readTool = { name: "search_properties", level: LEVEL.READ, capability: "read_properties" };
const writeTool = { name: "archive_offer", level: LEVEL.EXECUTE, capability: "archive" };
const deleteTool = { name: "wipe", level: LEVEL.READ, capability: "hard_delete" };

const readAgent = {
  name: "monitor", level: LEVEL.READ,
  allowedTools: ["search_properties", "archive_offer", "wipe"], forbiddenTools: [],
};

describe("assertAllowed", () => {
  it("يسمح لأداة قراءة لوكيل قراءة", () => {
    expect(assertAllowed({ agent: readAgent, tool: readTool })).toBe(true);
  });

  it("يمنع أداة تتجاوز مستوى الوكيل", () => {
    expect(() => assertAllowed({ agent: readAgent, tool: writeTool })).toThrow(PermissionError);
  });

  it("يمنع الحذف النهائي مهما كان المستوى", () => {
    const owner = { ...readAgent, level: LEVEL.APPROVAL };
    expect(() => assertAllowed({ agent: owner, tool: deleteTool })).toThrow(/ممنوعة على كل المستويات/);
  });

  it("hard_delete ضمن الممنوعات دائمًا", () => {
    expect(FORBIDDEN_ALWAYS).toContain("hard_delete");
    expect(FORBIDDEN_ALWAYS).toContain("raw_sql");
    expect(FORBIDDEN_ALWAYS).toContain("modify_rls");
  });

  it("يمنع أداة غير مدرجة ضمن أدوات الوكيل", () => {
    const limited = { ...readAgent, allowedTools: ["something_else"] };
    expect(() => assertAllowed({ agent: limited, tool: readTool })).toThrow(/ليست ضمن الأدوات المسموحة/);
  });

  it("يحترم المنع الصريح حتى لو كانت الأداة مسموحة", () => {
    const blocked = { ...readAgent, forbiddenTools: ["search_properties"] };
    expect(() => assertAllowed({ agent: blocked, tool: readTool })).toThrow(/ممنوعة صراحةً/);
  });

  it("يرفض النداء بلا وكيل أو بلا أداة", () => {
    expect(() => assertAllowed({ agent: null, tool: readTool })).toThrow(PermissionError);
    expect(() => assertAllowed({ agent: readAgent, tool: null })).toThrow(PermissionError);
  });
});
