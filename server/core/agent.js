/**
 * تعريف الوكلاء.
 *
 * كل وكيل ملزم بالعقد الكامل:
 *   Identity · Purpose · Allowed Tools · Forbidden Tools · Input/Output Schema
 *   · Permissions · Failure Policy · Retry Policy · Audit Policy
 *
 * التعريف الناقص يفشل عند الإنشاء لا عند التشغيل — الخطأ يظهر مبكرًا.
 *
 * لا يوجد Orchestrator يقوده نموذج لغة. الجدولة تقرر متى يعمل الوكيل،
 * والوكيل ينفّذ خطوات محددة، والأدوات تفرض الحدود.
 */

import { z } from "zod";
import { LEVEL } from "./permissions.js";
import { invokeTool, getTool } from "./tools.js";

const agents = new Map();

export class AgentDefinitionError extends Error {
  constructor(message) {
    super(message);
    this.name = "AgentDefinitionError";
  }
}

const failurePolicySchema = z.object({
  // abort: يوقف التشغيل. continue: يسجّل ويكمل. escalate: يوقف وينشئ عنصر مراجعة.
  onError: z.enum(["abort", "continue", "escalate"]).default("abort"),
  maxConsecutiveFailures: z.number().int().positive().default(3),
});

const retryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(5).default(2),
  backoffMs: z.number().int().min(0).default(2_000),
});

const auditPolicySchema = z.object({
  // كل نداء أداة يُسجَّل دائمًا؛ هذا يضبط تسجيل بداية/نهاية الوكيل نفسه.
  recordRuns: z.boolean().default(true),
  recordInputs: z.boolean().default(true),
});

/**
 * يعرّف وكيلًا ويسجّله.
 * @param {object} spec
 */
export function defineAgent(spec) {
  for (const key of ["name", "purpose", "level", "allowedTools", "run"]) {
    if (spec[key] === undefined) {
      throw new AgentDefinitionError(`تعريف الوكيل ناقص: ${key}`);
    }
  }
  if (agents.has(spec.name)) {
    throw new AgentDefinitionError(`الوكيل "${spec.name}" معرّف مسبقًا.`);
  }
  if (!Object.values(LEVEL).includes(spec.level)) {
    throw new AgentDefinitionError(`مستوى صلاحية غير صالح للوكيل "${spec.name}": ${spec.level}`);
  }
  if (!Array.isArray(spec.allowedTools) || spec.allowedTools.length === 0) {
    throw new AgentDefinitionError(`الوكيل "${spec.name}" بلا أدوات مسموحة.`);
  }

  // كل أداة مذكورة يجب أن تكون معرّفة فعلًا، وبمستوى لا يتجاوز مستوى الوكيل.
  for (const toolName of spec.allowedTools) {
    const tool = getTool(toolName);
    if (tool.level > spec.level) {
      throw new AgentDefinitionError(
        `الوكيل "${spec.name}" (مستوى ${spec.level}) لا يمكنه امتلاك الأداة ` +
        `"${toolName}" التي تتطلب مستوى ${tool.level}.`
      );
    }
  }

  const agent = Object.freeze({
    name: spec.name,
    purpose: spec.purpose,
    level: spec.level,
    allowedTools: Object.freeze([...spec.allowedTools]),
    forbiddenTools: Object.freeze([...(spec.forbiddenTools ?? [])]),
    inputSchema: spec.inputSchema ?? z.object({}).passthrough(),
    outputSchema: spec.outputSchema ?? z.unknown(),
    failurePolicy: failurePolicySchema.parse(spec.failurePolicy ?? {}),
    retryPolicy: retryPolicySchema.parse(spec.retryPolicy ?? {}),
    auditPolicy: auditPolicySchema.parse(spec.auditPolicy ?? {}),
    usesLLM: Boolean(spec.usesLLM),
    run: spec.run,
  });

  agents.set(agent.name, agent);
  return agent;
}

export function getAgent(name) {
  const agent = agents.get(name);
  if (!agent) throw new AgentDefinitionError(`وكيل غير معروف: "${name}"`);
  return agent;
}

export function listAgents() {
  return [...agents.values()].map((a) => ({
    name: a.name, purpose: a.purpose, level: a.level,
    tools: a.allowedTools, usesLLM: a.usesLLM,
  }));
}

/** للاختبارات فقط. */
export function _resetAgents() {
  agents.clear();
}

/**
 * يشغّل وكيلًا ضمن سياق محكوم.
 * الأداة الوحيدة المتاحة له هي ctx.tool — لا وصول مباشر لقاعدة البيانات.
 */
export async function runAgent(agent, input, baseCtx) {
  const parsed = agent.inputSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new AgentDefinitionError(
      `مدخلات غير صالحة للوكيل "${agent.name}": ${JSON.stringify(parsed.error.issues)}`
    );
  }

  const ctx = {
    ...baseCtx,
    agent,
    logger: baseCtx.logger?.child?.({ agent: agent.name }) ?? baseCtx.logger,
    /** المنفذ الوحيد لأي تأثير خارجي. */
    tool: (name, args) => invokeTool(name, args, { ...ctx, agent }),
  };

  const result = await agent.run(parsed.data, ctx);

  const parsedOut = agent.outputSchema.safeParse(result);
  if (!parsedOut.success) {
    throw new AgentDefinitionError(
      `مخرجات غير صالحة من الوكيل "${agent.name}": ${JSON.stringify(parsedOut.error.issues)}`
    );
  }
  return parsedOut.data;
}

export { LEVEL };
