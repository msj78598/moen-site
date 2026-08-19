/**
 * أدوات القراءة (المستوى 1).
 *
 * لا يستطيع أي وكيل قراءة قاعدة البيانات إلا من خلال هذه الأدوات.
 * كل أداة تعرف بالضبط ما تقرأه وما تُرجعه — لا `select *` مفتوح للنموذج،
 * ولا تمرير فلاتر خام.
 */

import { defineTool, LEVEL, z } from "../core/tools.js";

const propertySchema = z.object({
  id: z.string(),
  type: z.string().nullable(),
  location: z.string().nullable(),
  size: z.string().nullable(),
  price: z.string().nullable(),
  status: z.string().nullable(),
  source_type: z.string().nullable(),
  source_url: z.string().nullable(),
  image_url: z.string().nullable(),
  created_at: z.string().nullable(),
});

const offerSchema = z.object({
  id: z.string(),
  type: z.string().nullable(),
  location: z.string().nullable(),
  size: z.string().nullable(),
  price: z.string().nullable(),
  status: z.string().nullable(),
  source_name: z.string().nullable(),
  source_url: z.string().nullable(),
  checked_at: z.string().nullable(),
});

export const searchProperties = defineTool({
  name: "search_properties",
  description: "يبحث في عروض المكتب بفلاتر محددة مسبقًا. قراءة فقط.",
  level: LEVEL.READ,
  capability: "read_properties",
  input: z.object({
    status: z.enum(["published", "draft", "archived", "rejected", "any"]).default("any"),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  output: z.object({ count: z.number(), rows: z.array(propertySchema) }),
  async handler({ status, limit }, { db }) {
    let query = db
      .from("properties")
      .select("id,type,location,size,price,status,source_type,source_url,image_url,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "any") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new Error(`قراءة properties فشلت: ${error.message}`);
    return { count: data.length, rows: data };
  },
});

export const getProperty = defineTool({
  name: "get_property",
  description: "يجلب عرض مكتب واحد بالمعرّف. قراءة فقط.",
  level: LEVEL.READ,
  capability: "read_properties",
  input: z.object({ id: z.string().min(1) }),
  output: z.object({ found: z.boolean(), row: propertySchema.nullable() }),
  async handler({ id }, { db }) {
    const { data, error } = await db
      .from("properties")
      .select("id,type,location,size,price,status,source_type,source_url,image_url,created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`قراءة العرض فشلت: ${error.message}`);
    return { found: Boolean(data), row: data ?? null };
  },
});

export const searchExternalOffers = defineTool({
  name: "search_external_offers",
  description: "يبحث في العروض الخارجية المرصودة. قراءة فقط.",
  level: LEVEL.READ,
  capability: "read_external_offers",
  input: z.object({
    status: z.enum(["published", "draft", "archived", "rejected", "any"]).default("published"),
    limit: z.number().int().min(1).max(500).default(100),
  }),
  output: z.object({ count: z.number(), rows: z.array(offerSchema) }),
  async handler({ status, limit }, { db }) {
    let query = db
      .from("external_offers")
      .select("id,type,location,size,price,status,source_name,source_url,checked_at")
      .order("checked_at", { ascending: false })
      .limit(limit);

    if (status !== "any") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new Error(`قراءة external_offers فشلت: ${error.message}`);
    return { count: data.length, rows: data };
  },
});

export const countByStatus = defineTool({
  name: "count_by_status",
  description: "يعدّ الصفوف حسب الحالة في جدول مسموح. قراءة فقط.",
  level: LEVEL.READ,
  capability: "read_counts",
  // قائمة بيضاء صريحة — لا يستطيع الوكيل تمرير أي اسم جدول.
  input: z.object({ table: z.enum(["properties", "external_offers"]) }),
  output: z.object({ table: z.string(), counts: z.record(z.string(), z.number()) }),
  async handler({ table }, { db }) {
    const { data, error } = await db.from(table).select("status");
    if (error) throw new Error(`العد فشل على ${table}: ${error.message}`);
    const counts = {};
    for (const row of data) {
      const key = row.status ?? "(null)";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return { table, counts };
  },
});

export const checkUrlLiveness = defineTool({
  name: "check_url_liveness",
  description: "يفحص أن رابطًا خارجيًا ما زال يستجيب. لا يعدّل شيئًا.",
  level: LEVEL.READ,
  capability: "network_read",
  input: z.object({
    url: z.string().url(),
    timeoutMs: z.number().int().min(1_000).max(30_000).default(10_000),
  }),
  output: z.object({
    url: z.string(),
    ok: z.boolean(),
    status: z.number().nullable(),
    error: z.string().nullable(),
  }),
  async handler({ url, timeoutMs }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "MoenRealEstateBot/1.0 (+https://moen-site.vercel.app)",
          accept: "text/html,application/xhtml+xml",
        },
      });
      return { url, ok: response.ok, status: response.status, error: null };
    } catch (error) {
      return { url, ok: false, status: null, error: error.message };
    } finally {
      clearTimeout(timer);
    }
  },
});
