-- 0003_leads.sql
-- الغرض: حفظ كل طلب عميل قبل فتح واتساب.
-- اليوم: صفر طلبات محفوظة — كل عميل يضيع داخل واتساب بلا أثر.
-- Sprint 1 / المرحلة 1
--
-- مبدأ الخصوصية الحاكم:
--   الزائر المجهول يستطيع الإدخال (INSERT) فقط.
--   لا يستطيع القراءة ولا التعديل ولا الحذف — ولا حتى قراءة ما أدخله بنفسه.
--   القراءة للموظفين المسجّلين فقط.

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- نوع الطلب
  lead_type       text not null,
    -- marketing_request : صاحب عقار يطلب تسويق عقاره
    -- service_request   : طلب خدمة عامة / معاملة
    -- property_inquiry  : استفسار عن عرض محدد
    -- search_request    : عميل يبحث عن عقار (يستخدمه Lead Matcher لاحقًا)

  -- بيانات المتقدم
  name            text not null,
  phone           text not null,
  phone_normalized text,          -- 9627XXXXXXXX — يملؤه trigger أدناه
  whatsapp        text,
  email           text,

  -- الطلب كما كتبه العميل (مصدر الحقيقة النصي)
  request_text    text,

  -- حقول منظمة (اختيارية — يملؤها الموظف أو Lead Matcher لاحقًا)
  property_type   text,
  location        text,
  min_price       numeric,
  max_price       numeric,
  currency        text default 'JOD',
  min_size        numeric,
  max_size        numeric,

  -- دورة حياة الطلب
  status          text not null default 'new',
  assigned_to     uuid references auth.users (id) on delete set null,
  last_contact_at timestamptz,
  notes           text,

  -- المصدر والتتبع
  source          text not null default 'website',
  source_detail   text,
  related_property_id uuid references public.properties (id) on delete set null,
  attachment_url  text,
  raw_payload     jsonb not null default '{}'::jsonb,

  -- الحذف الناعم
  deleted_at      timestamptz,

  constraint leads_lead_type_check check (
    lead_type in ('marketing_request','service_request','property_inquiry','search_request')
  ),
  constraint leads_status_check check (
    status in ('new','contacted','qualified','converted','closed','spam')
  ),
  constraint leads_name_not_blank  check (length(btrim(name))  > 0),
  constraint leads_phone_not_blank check (length(btrim(phone)) > 0)
);

comment on table  public.leads is 'كل طلب عميل من الموقع. يُحفظ قبل فتح واتساب.';
comment on column public.leads.raw_payload is 'نسخة كاملة مما أُرسل من النموذج — للتدقيق وإعادة المعالجة. ممنوع تخزين أي مفاتيح أو أسرار.';

create index if not exists leads_status_created_idx
  on public.leads (status, created_at desc) where deleted_at is null;
create index if not exists leads_type_created_idx
  on public.leads (lead_type, created_at desc) where deleted_at is null;
create index if not exists leads_phone_idx
  on public.leads (phone_normalized) where deleted_at is null;

-- ===============================================================
-- تطبيع رقم الهاتف الأردني على مستوى قاعدة البيانات
-- (نفس منطق normalPhone في src/App.jsx — لكن هنا لا يمكن تجاوزه)
-- ===============================================================
create or replace function public.fn_leads_normalize_phone()
returns trigger
language plpgsql
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');

  if digits like '00962%' then
    digits := '962' || substring(digits from 6);
  elsif digits like '0%' then
    digits := '962' || substring(digits from 2);
  end if;

  new.phone_normalized := nullif(digits, '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_leads_normalize_phone on public.leads;
create trigger trg_leads_normalize_phone
  before insert or update on public.leads
  for each row execute function public.fn_leads_normalize_phone();
