/**
 * مستويات صلاحيات الوكلاء.
 *
 * المبدأ الحاكم: هذه المستويات تُفرض في الكود وفي قاعدة البيانات معًا،
 * ولا يكفي ذكرها في نص التعليمات (prompt) — نموذج اللغة لا يُوثق به
 * كطبقة تحكم.
 *
 * الطبقة النهائية والحاسمة هي أدوار Postgres و RLS:
 * ما لا يملك الدور صلاحيته لا يستطيع النموذج فعله مهما قيل له.
 * هذا الملف هو الحاجز الأول فقط.
 */

export const LEVEL = Object.freeze({
  READ: 1,        // قراءة فقط
  SUGGEST: 2,     // يكتب في طوابير المراجعة/الحالات المؤقتة فقط
  EXECUTE: 3,     // عمليات غير حساسة (مثل status -> archived)
  PUBLISH: 4,     // نشر تلقائي على حقول محددة
  APPROVAL: 5,    // يتطلب موافقة بشرية — لا صلاحية كتابة مباشرة إطلاقًا
});

export const LEVEL_NAMES = Object.freeze({
  1: "read", 2: "suggest", 3: "execute", 4: "publish", 5: "approval",
});

/**
 * عمليات ممنوعة على كل المستويات بلا استثناء.
 * الحذف النهائي غير مسموح لأي وكيل مهما كان مستواه.
 */
export const FORBIDDEN_ALWAYS = Object.freeze([
  "hard_delete",
  "raw_sql",
  "modify_rls",
  "modify_auth",
  "modify_schema",
]);

export class PermissionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "PermissionError";
    this.details = details;
  }
}

/**
 * يتحقق أن الوكيل يملك المستوى الكافي لاستخدام الأداة.
 * يرمي PermissionError عند الرفض — الفشل صريح لا صامت.
 */
export function assertAllowed({ agent, tool }) {
  if (!agent) throw new PermissionError("لا يوجد وكيل محدد للعملية.");
  if (!tool) throw new PermissionError("لا توجد أداة محددة للعملية.");

  if (FORBIDDEN_ALWAYS.includes(tool.capability)) {
    throw new PermissionError(`العملية "${tool.capability}" ممنوعة على كل المستويات.`, {
      agent: agent.name, tool: tool.name,
    });
  }

  if (Array.isArray(agent.forbiddenTools) && agent.forbiddenTools.includes(tool.name)) {
    throw new PermissionError(`الأداة "${tool.name}" ممنوعة صراحةً على الوكيل "${agent.name}".`, {
      agent: agent.name, tool: tool.name,
    });
  }

  if (!Array.isArray(agent.allowedTools) || !agent.allowedTools.includes(tool.name)) {
    throw new PermissionError(
      `الأداة "${tool.name}" ليست ضمن الأدوات المسموحة للوكيل "${agent.name}".`,
      { agent: agent.name, tool: tool.name, allowed: agent.allowedTools ?? [] }
    );
  }

  if (tool.level > agent.level) {
    throw new PermissionError(
      `الأداة "${tool.name}" تتطلب مستوى ${tool.level} (${LEVEL_NAMES[tool.level]}) ` +
      `والوكيل "${agent.name}" عند مستوى ${agent.level} (${LEVEL_NAMES[agent.level]}).`,
      { agent: agent.name, tool: tool.name, required: tool.level, actual: agent.level }
    );
  }

  return true;
}
