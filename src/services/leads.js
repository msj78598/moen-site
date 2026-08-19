/**
 * خدمة الطلبات (Leads).
 *
 * المشكلة التي تحلها:
 *   قبل هذا الملف كان submitMarketingRequest و submitServiceRequest في src/App.jsx
 *   يفتحان واتساب مباشرة بلا أي حفظ. كل عميل محتمل كان يضيع بلا أثر رقمي.
 *
 * القاعدة الآن: يُحفظ الطلب أولًا. إن فشل الحفظ لا تُعتبر العملية ناجحة
 * ولا يُفتح واتساب.
 *
 * التصميم: دوال البناء والتحقق نقية (pure) وقابلة للاختبار بلا شبكة.
 * دالة واحدة فقط (createLead) تلمس قاعدة البيانات.
 */

import { normalizeJordanPhone, looksLikeValidPhone } from "../lib/phone.js";

export const LEAD_TYPE = Object.freeze({
  MARKETING_REQUEST: "marketing_request",
  SERVICE_REQUEST: "service_request",
  PROPERTY_INQUIRY: "property_inquiry",
  SEARCH_REQUEST: "search_request",
});

/** حدود مطابقة لقيود CHECK وسياسة RLS في قاعدة البيانات. */
const LIMITS = Object.freeze({
  NAME_MIN: 2,
  NAME_MAX: 120,
  PHONE_MIN: 6,
  PHONE_MAX: 30,
  TEXT_MAX: 4000,
});

export class LeadValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "LeadValidationError";
    this.field = field;
  }
}

export class LeadPersistenceError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "LeadPersistenceError";
    this.cause = cause;
  }
}

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clamp(value, max) {
  const text = trimmed(value);
  return text ? text.slice(0, max) : null;
}

/**
 * تحقق يعمل قبل أي نداء شبكة، ويطابق ما تفرضه قاعدة البيانات.
 * الهدف رسالة عربية واضحة للمستخدم بدل خطأ Postgres خام.
 */
export function validateLead(lead) {
  const name = trimmed(lead?.name);
  const phone = trimmed(lead?.phone);

  if (name.length < LIMITS.NAME_MIN) {
    throw new LeadValidationError("يرجى كتابة الاسم بشكل صحيح.", "name");
  }
  if (name.length > LIMITS.NAME_MAX) {
    throw new LeadValidationError("الاسم طويل جدًا.", "name");
  }
  if (phone.length < LIMITS.PHONE_MIN || phone.length > LIMITS.PHONE_MAX) {
    throw new LeadValidationError("يرجى كتابة رقم تواصل صحيح.", "phone");
  }
  if (!looksLikeValidPhone(phone)) {
    throw new LeadValidationError("رقم التواصل غير صالح.", "phone");
  }
  if (!Object.values(LEAD_TYPE).includes(lead?.lead_type)) {
    throw new LeadValidationError("نوع الطلب غير معروف.", "lead_type");
  }

  return true;
}

/**
 * يبني صف طلب تسويق عقار من نموذج الموقع.
 * لا يلمس الشبكة — نقي وقابل للاختبار.
 */
export function buildMarketingLead(form, { attachmentUrl = null } = {}) {
  const requestText = [
    `نوع العقار: ${trimmed(form?.propertyType) || "غير محدد"}`,
    `الموقع / الحوض: ${trimmed(form?.location) || "غير محدد"}`,
    `المساحة: ${trimmed(form?.area) || "غير محددة"}`,
    `السعر المطلوب: ${trimmed(form?.price) || "غير محدد"}`,
    `هل العرض حصري؟ ${trimmed(form?.exclusive) || "غير محدد"}`,
    `التفاصيل: ${trimmed(form?.details) || "لا توجد تفاصيل إضافية"}`,
  ].join("\n");

  return {
    lead_type: LEAD_TYPE.MARKETING_REQUEST,
    name: trimmed(form?.ownerName),
    phone: trimmed(form?.phone),
    whatsapp: normalizeJordanPhone(form?.phone) || null,
    request_text: clamp(requestText, LIMITS.TEXT_MAX),
    property_type: clamp(form?.propertyType, 120),
    location: clamp(form?.location, 240),
    status: "new",
    source: "website",
    source_detail: "marketing_request_form",
    attachment_url: attachmentUrl,
    raw_payload: {
      ownerName: trimmed(form?.ownerName),
      phone: trimmed(form?.phone),
      propertyType: trimmed(form?.propertyType),
      location: trimmed(form?.location),
      area: trimmed(form?.area),
      price: trimmed(form?.price),
      exclusive: trimmed(form?.exclusive),
      details: trimmed(form?.details),
      attachmentName: form?.attachment?.name ?? null,
    },
  };
}

/** يبني صف طلب خدمة عامة من نموذج الموقع. */
export function buildServiceLead(form, { attachmentUrl = null } = {}) {
  const requestText = [
    `نوع الخدمة المطلوبة: ${trimmed(form?.serviceType) || "غير محدد"}`,
    `الجهة / الدائرة: ${trimmed(form?.authority) || "غير محددة"}`,
    `المنطقة / الموقع: ${trimmed(form?.location) || "غير محدد"}`,
    `درجة الاستعجال: ${trimmed(form?.urgency) || "عادي"}`,
    `تفاصيل المعاملة: ${trimmed(form?.details) || "لا توجد تفاصيل"}`,
  ].join("\n");

  return {
    lead_type: LEAD_TYPE.SERVICE_REQUEST,
    name: trimmed(form?.customerName),
    phone: trimmed(form?.phone),
    whatsapp: normalizeJordanPhone(form?.phone) || null,
    request_text: clamp(requestText, LIMITS.TEXT_MAX),
    location: clamp(form?.location, 240),
    status: "new",
    source: "website",
    source_detail: "service_request_form",
    attachment_url: attachmentUrl,
    raw_payload: {
      customerName: trimmed(form?.customerName),
      phone: trimmed(form?.phone),
      serviceType: trimmed(form?.serviceType),
      authority: trimmed(form?.authority),
      location: trimmed(form?.location),
      urgency: trimmed(form?.urgency),
      details: trimmed(form?.details),
      attachmentName: form?.attachment?.name ?? null,
    },
  };
}

/**
 * يحفظ الطلب. يرمي استثناء عند الفشل — ولا يبتلع الخطأ.
 *
 * ملاحظة أمنية: `.select("id")` هنا لا يعمل مع سياسة RLS الحالية،
 * لأن الزائر المجهول يملك INSERT فقط ولا يملك SELECT على leads.
 * لهذا نتحقق من النجاح عبر غياب error لا عبر البيانات المرتجعة.
 */
export async function createLead(client, lead) {
  validateLead(lead);

  if (!client?.from) {
    throw new LeadPersistenceError("تعذر الاتصال بقاعدة البيانات.");
  }

  const { error } = await client.from("leads").insert(lead);

  if (error) {
    throw new LeadPersistenceError(
      "تعذر حفظ الطلب. يرجى المحاولة مرة أخرى أو الاتصال بالمكتب مباشرة.",
      error
    );
  }

  return { saved: true };
}
