/**
 * مزوّد "لا ذكاء اصطناعي".
 *
 * ليس بديلًا صوريًا — هو الوضع الافتراضي المقصود.
 * وجوده يضمن أن كل مسار في النظام له طريق حتمي يعمل بدون نموذج.
 */

import { LLMUnavailableError } from "../llm-provider.js";

export function createUnavailableProvider(reason = "لم يُضبط أي مزوّد") {
  return {
    name: "unavailable",
    reason,
    async isAvailable() {
      return false;
    },
    async complete() {
      throw new LLMUnavailableError(`الذكاء الاصطناعي غير متاح: ${reason}`);
    },
    async extractJson() {
      throw new LLMUnavailableError(`الذكاء الاصطناعي غير متاح: ${reason}`);
    },
  };
}
