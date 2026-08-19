/**
 * تطبيع أرقام الهاتف الأردنية.
 *
 * نُقل من normalPhone داخل src/App.jsx ليصبح قابلًا للاختبار ومشتركًا
 * بين الواجهة وخدمة الطلبات.
 *
 * يقابل: public.fn_leads_normalize_phone في supabase/migrations/0003_leads.sql
 * (قاعدة البيانات تعيد التطبيع بنفسها — الواجهة لا يُوثق بها كمصدر وحيد.)
 */

/** "0772050566" | "00962772050566" | "+962 77 205 0566"  ->  "962772050566" */
export function normalizeJordanPhone(phone) {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("00962")) {
    digits = `962${digits.slice(5)}`;
  } else if (digits.startsWith("0")) {
    digits = `962${digits.slice(1)}`;
  }

  return digits;
}

/** فحص شكلي بسيط — ليس تحققًا من وجود الرقم فعلًا. */
export function looksLikeValidPhone(phone) {
  const digits = normalizeJordanPhone(phone);
  return digits.length >= 9 && digits.length <= 15;
}

/** رابط واتساب جاهز مع نص مُرمّز. */
export function whatsAppUrl(phone, message) {
  const target = normalizeJordanPhone(phone);
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${target}${text}`;
}
