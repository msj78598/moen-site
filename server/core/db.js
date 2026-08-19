/**
 * وصول قاعدة البيانات للعامل.
 *
 * قاعدة أمنية مركزية: هذا الملف هو الموضع الوحيد الذي يلمس service_role.
 * لا يُمرَّر العميل إلى أي مزوّد نماذج، ولا تُستدعى منه عمليات حذف.
 * الوكلاء لا يستوردون هذا الملف — يصلون للبيانات عبر الأدوات فقط.
 */

import { createClient } from "@supabase/supabase-js";
import { config, hasWriteCredentials } from "./config.js";

let client = null;

export function getDb() {
  if (client) return client;

  const key = config.supabase.serviceRoleKey || config.supabase.publishableKey;
  if (!config.supabase.url || !key) {
    throw new Error("إعدادات Supabase ناقصة — راجع SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY.");
  }

  client = createClient(config.supabase.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** هل يستطيع العامل الكتابة أصلًا؟ بدون service role يبقى في وضع القراءة. */
export function canWrite() {
  return hasWriteCredentials();
}

/**
 * الحذف النهائي ممنوع من داخل العامل — على مستوى الكود لا التعليمات.
 * أي محاولة استدعاء تفشل صراحةً.
 */
export function hardDelete() {
  throw new Error(
    "الحذف النهائي ممنوع من العامل. استخدم الأرشفة (status='archived' + deleted_at)."
  );
}

/** فحص اتصال بسيط للقراءة فقط. */
export async function ping() {
  const { error } = await getDb().from("contacts").select("id").limit(1);
  return { ok: !error, error: error?.message ?? null };
}
