-- 0007_sources.sql
--
-- ⚠️ لم يُنفَّذ. مُقترح للمراجعة فقط — Sprint 2 لا يكتب على الإنتاج.
--
-- الغرض: إخراج المصادر من الكود المكتوب يدويًا إلى سجل تُدار حالته بالبيانات.
-- اليوم المصدر مكتوب داخل scripts/update-external-offers.mjs، فلا يمكن
-- تعطيله أو تغيير حالة إذنه بلا تعديل كود ونشر.
--
-- المبدأ الحاكم: لا يعمل أي مصدر إلا بحالة permission_status='granted'
-- صريحة و enabled=true. الافتراضي هو المنع لا السماح.
--
-- Sprint 2

create table if not exists public.sources (
  id                      uuid primary key default gen_random_uuid(),

  source_name             text not null unique,
  source_url              text not null,
  source_type             text not null default 'listing_site',
    -- listing_site | agency | classifieds | api | manual

  -- ===== بوابة الإذن =====
  permission_status       text not null default 'pending',
    -- pending | granted | denied
    -- pending هو الافتراضي: مصدر جديد ممنوع حتى يُبتّ فيه.
  permission_note         text,
  permission_reviewed_at  timestamptz,

  enabled                 boolean not null default false,
    -- مفتاح تشغيل منفصل عن الإذن: مصدر مسموح قد يُعطَّل مؤقتًا للصيانة.

  -- ===== المحوّل والجدولة =====
  adapter                 text not null,
    -- اسم المحوّل في server/ingestion/adapters/
  scrape_interval_minutes integer not null default 1440,
  max_offers_per_run      integer not null default 36,

  -- حماية الجولة الناقصة (Sprint 4): لا تُؤرشف إن هبطت الحصيلة أكثر من هذه النسبة
  max_allowed_drop_percent integer not null default 30,

  -- ===== حالة آخر تشغيل =====
  last_checked_at         timestamptz,
  last_success_at         timestamptz,
  last_error              text,
  last_offer_count        integer,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint sources_permission_check
    check (permission_status in ('pending','granted','denied')),
  constraint sources_type_check
    check (source_type in ('listing_site','agency','classifieds','api','manual'))
);

comment on table public.sources is
  'سجل مصادر العروض الخارجية. لا يعمل مصدر إلا بـ permission_status=granted و enabled=true.';
comment on column public.sources.permission_status is
  'pending = لم يُبتّ في الإذن (ممنوع التشغيل) | granted = إذن موثّق | denied = مرفوض نهائيًا';
comment on column public.sources.max_allowed_drop_percent is
  'أقصى هبوط مسموح في عدد العروض قبل اعتبار الجولة مشبوهة ووقف الأرشفة.';

create index if not exists sources_runnable_idx
  on public.sources (enabled, permission_status)
  where enabled = true and permission_status = 'granted';

-- ===============================================================
-- RLS: السجل ليس بيانات عامة. الكتابة للعامل عبر service_role فقط.
-- ===============================================================
alter table public.sources enable row level security;

drop policy if exists sources_staff_read on public.sources;
create policy sources_staff_read on public.sources
  for select to authenticated
  using (public.is_staff());

revoke insert, update, delete on public.sources from anon, authenticated;

-- ===============================================================
-- تدقيق التغييرات على السجل (نفس trigger الموجود في 0004)
-- ===============================================================
drop trigger if exists trg_audit_sources on public.sources;
create trigger trg_audit_sources
  after insert or update or delete on public.sources
  for each row execute function public.fn_audit();

-- ===============================================================
-- البذرة: المصدر الوحيد المعروف حاليًا — معطّل وبإذن غير محسوم.
-- مطابق لـ server/sources/seed.js
-- ===============================================================
insert into public.sources (
  source_name, source_url, source_type, adapter,
  permission_status, permission_note, enabled, max_offers_per_run
) values (
  'دليل عقار',
  'https://daleelaqar.com/search/%D8%B9%D9%82%D8%A7%D8%B1%D8%A7%D8%AA-%D9%84%D9%84%D8%A8%D9%8A%D8%B9/%D8%A7%D8%B1%D8%A8%D8%AF',
  'listing_site',
  'daleelaqar',
  'pending',
  'لم يُحسم وضع الإذن. معطّل حتى المراجعة القانونية.',
  false,
  36
)
on conflict (source_name) do nothing;
