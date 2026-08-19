import { describe, it, expect, vi } from "vitest";
import {
  buildMarketingLead,
  buildServiceLead,
  createLead,
  validateLead,
  LeadValidationError,
  LeadPersistenceError,
  LEAD_TYPE,
} from "../leads.js";

/** عميل Supabase مزيّف — لا شبكة. */
function fakeClient({ error = null } = {}) {
  const insert = vi.fn().mockResolvedValue({ error });
  return { client: { from: vi.fn(() => ({ insert })) }, insert };
}

const validMarketingForm = {
  ownerName: "المختار محمود عبابنه",
  phone: "0772050566",
  propertyType: "أرض سكنية",
  location: "إربد - إيدون",
  area: "854",
  price: "80000",
  exclusive: "نعم",
  details: "قوشان مستقل",
};

const validServiceForm = {
  customerName: "معين عبابنه",
  phone: "0796181720",
  serviceType: "معاملة تسجيل",
  authority: "دائرة الأراضي",
  location: "إربد",
  urgency: "مستعجل",
  details: "نقل ملكية",
};

describe("buildMarketingLead", () => {
  it("يبني صفًا صالحًا بالنوع الصحيح", () => {
    const lead = buildMarketingLead(validMarketingForm);
    expect(lead.lead_type).toBe(LEAD_TYPE.MARKETING_REQUEST);
    expect(lead.name).toBe("المختار محمود عبابنه");
    expect(lead.status).toBe("new");
    expect(lead.source_detail).toBe("marketing_request_form");
  });

  it("يطبّع رقم واتساب إلى الصيغة الدولية", () => {
    expect(buildMarketingLead(validMarketingForm).whatsapp).toBe("962772050566");
  });

  it("يجمع كل تفاصيل النموذج داخل request_text", () => {
    const lead = buildMarketingLead(validMarketingForm);
    expect(lead.request_text).toContain("أرض سكنية");
    expect(lead.request_text).toContain("إربد - إيدون");
    expect(lead.request_text).toContain("قوشان مستقل");
  });

  it("لا يفقد شيئًا: raw_payload يحتفظ بالمدخلات الأصلية", () => {
    const lead = buildMarketingLead(validMarketingForm);
    expect(lead.raw_payload.exclusive).toBe("نعم");
    expect(lead.raw_payload.area).toBe("854");
  });

  it("لا ينهار مع نموذج فارغ", () => {
    const lead = buildMarketingLead({});
    expect(lead.name).toBe("");
    expect(lead.request_text).toContain("غير محدد");
  });

  it("يقتطع النص الطويل عند الحد الذي تفرضه قاعدة البيانات", () => {
    const lead = buildMarketingLead({ ...validMarketingForm, details: "ب".repeat(9000) });
    expect(lead.request_text.length).toBeLessThanOrEqual(4000);
  });

  it("يسجل اسم المرفق ورابطه", () => {
    const lead = buildMarketingLead(
      { ...validMarketingForm, attachment: { name: "قوشان.pdf" } },
      { attachmentUrl: "https://example.test/a.pdf" }
    );
    expect(lead.attachment_url).toBe("https://example.test/a.pdf");
    expect(lead.raw_payload.attachmentName).toBe("قوشان.pdf");
  });
});

describe("buildServiceLead", () => {
  it("يبني صفًا صالحًا بنوع طلب الخدمة", () => {
    const lead = buildServiceLead(validServiceForm);
    expect(lead.lead_type).toBe(LEAD_TYPE.SERVICE_REQUEST);
    expect(lead.name).toBe("معين عبابنه");
    expect(lead.request_text).toContain("دائرة الأراضي");
  });
});

describe("validateLead", () => {
  it("يقبل طلبًا صحيحًا", () => {
    expect(validateLead(buildMarketingLead(validMarketingForm))).toBe(true);
  });

  it("يرفض الاسم الفارغ", () => {
    const lead = buildMarketingLead({ ...validMarketingForm, ownerName: "" });
    expect(() => validateLead(lead)).toThrow(LeadValidationError);
  });

  it("يرفض رقم هاتف قصير", () => {
    const lead = buildMarketingLead({ ...validMarketingForm, phone: "123" });
    expect(() => validateLead(lead)).toThrow(LeadValidationError);
  });

  it("يشير إلى الحقل الذي فشل التحقق فيه", () => {
    const lead = buildMarketingLead({ ...validMarketingForm, phone: "" });
    try {
      validateLead(lead);
      throw new Error("كان يجب أن يفشل");
    } catch (error) {
      expect(error).toBeInstanceOf(LeadValidationError);
      expect(error.field).toBe("phone");
    }
  });

  it("يرفض نوع طلب غير معروف", () => {
    expect(() =>
      validateLead({ ...buildMarketingLead(validMarketingForm), lead_type: "whatever" })
    ).toThrow(LeadValidationError);
  });
});

describe("createLead", () => {
  it("يكتب في جدول leads عند النجاح", async () => {
    const { client, insert } = fakeClient();
    const lead = buildMarketingLead(validMarketingForm);

    await expect(createLead(client, lead)).resolves.toEqual({ saved: true });
    expect(client.from).toHaveBeenCalledWith("leads");
    expect(insert).toHaveBeenCalledWith(lead);
  });

  it("يرمي استثناءً عند فشل قاعدة البيانات — ولا يبتلع الخطأ", async () => {
    const { client } = fakeClient({ error: { message: "permission denied" } });
    const lead = buildMarketingLead(validMarketingForm);

    await expect(createLead(client, lead)).rejects.toBeInstanceOf(LeadPersistenceError);
  });

  it("لا يصل إلى قاعدة البيانات إن فشل التحقق", async () => {
    const { client, insert } = fakeClient();
    const lead = buildMarketingLead({ ...validMarketingForm, ownerName: "" });

    await expect(createLead(client, lead)).rejects.toBeInstanceOf(LeadValidationError);
    expect(insert).not.toHaveBeenCalled();
  });
});
