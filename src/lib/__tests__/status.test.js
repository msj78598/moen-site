import { describe, it, expect } from "vitest";
import {
  STATUS,
  normalizeStatus,
  isPubliclyVisible,
  publicOnly,
  statusLabel,
} from "../status.js";

describe("normalizeStatus", () => {
  it("يمرّر القيم المعيارية كما هي", () => {
    expect(normalizeStatus("published")).toBe(STATUS.PUBLISHED);
    expect(normalizeStatus("draft")).toBe(STATUS.DRAFT);
    expect(normalizeStatus("archived")).toBe(STATUS.ARCHIVED);
    expect(normalizeStatus("rejected")).toBe(STATUS.REJECTED);
  });

  it("يحوّل القيم العربية القديمة", () => {
    expect(normalizeStatus("متاح")).toBe(STATUS.PUBLISHED);
    expect(normalizeStatus("منشور")).toBe(STATUS.PUBLISHED);
    expect(normalizeStatus("مباع")).toBe(STATUS.ARCHIVED);
    expect(normalizeStatus("محجوز")).toBe(STATUS.ARCHIVED);
    expect(normalizeStatus("مسودة")).toBe(STATUS.DRAFT);
    expect(normalizeStatus("مرفوض")).toBe(STATUS.REJECTED);
  });

  it("منع التراجع: الفارغ و null يبقيان منشورين كما كان السلوك السابق", () => {
    // الكود السابق كان: row.status || "متاح"  أي أن غياب الحالة = ظاهر للعامة.
    expect(normalizeStatus(null)).toBe(STATUS.PUBLISHED);
    expect(normalizeStatus(undefined)).toBe(STATUS.PUBLISHED);
    expect(normalizeStatus("")).toBe(STATUS.PUBLISHED);
    expect(normalizeStatus("   ")).toBe(STATUS.PUBLISHED);
  });

  it("الآمن افتراضيًا: القيمة غير المعروفة تصبح مسودة لا منشورة", () => {
    expect(normalizeStatus("قيمة غريبة")).toBe(STATUS.DRAFT);
    expect(normalizeStatus("PUBLISHED_TYPO")).toBe(STATUS.DRAFT);
  });

  it("يتجاهل المسافات الزائدة", () => {
    expect(normalizeStatus("  published  ")).toBe(STATUS.PUBLISHED);
    expect(normalizeStatus(" متاح ")).toBe(STATUS.PUBLISHED);
  });
});

describe("isPubliclyVisible", () => {
  it("يظهر المنشور غير المحذوف", () => {
    expect(isPubliclyVisible({ status: "published" })).toBe(true);
    expect(isPubliclyVisible({ status: "متاح" })).toBe(true);
  });

  it("يخفي المسودة والمؤرشف والمرفوض", () => {
    expect(isPubliclyVisible({ status: "draft" })).toBe(false);
    expect(isPubliclyVisible({ status: "archived" })).toBe(false);
    expect(isPubliclyVisible({ status: "rejected" })).toBe(false);
  });

  it("يخفي المحذوف ناعمًا حتى لو كانت حالته published", () => {
    expect(isPubliclyVisible({ status: "published", deleted_at: "2026-08-19T00:00:00Z" })).toBe(false);
    expect(isPubliclyVisible({ status: "published", deletedAt: "2026-08-19T00:00:00Z" })).toBe(false);
  });

  it("يتعامل مع المدخلات الفارغة بأمان", () => {
    expect(isPubliclyVisible(null)).toBe(false);
    expect(isPubliclyVisible(undefined)).toBe(false);
  });
});

describe("publicOnly", () => {
  it("يبقي المنشور فقط", () => {
    const rows = [
      { id: 1, status: "published" },
      { id: 2, status: "draft" },
      { id: 3, status: "متاح" },
      { id: 4, status: "archived" },
      { id: 5, status: "published", deleted_at: "2026-08-19T00:00:00Z" },
      { id: 6 }, // بلا حالة = منشور (حفاظًا على السلوك السابق)
    ];
    expect(publicOnly(rows).map((r) => r.id)).toEqual([1, 3, 6]);
  });

  it("يعيد مصفوفة فارغة لأي مدخل غير مصفوفة", () => {
    expect(publicOnly(null)).toEqual([]);
    expect(publicOnly(undefined)).toEqual([]);
  });
});

describe("statusLabel", () => {
  it("يعطي تسمية عربية لكل حالة", () => {
    expect(statusLabel("published")).toBe("منشور");
    expect(statusLabel("متاح")).toBe("منشور");
    expect(statusLabel("archived")).toBe("مؤرشف");
  });
});
