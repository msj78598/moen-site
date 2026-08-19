-- 0001_baseline_schema.sql
--
-- 📌 هذا الملف توثيقي — لا تشغّله على قاعدة البيانات الحالية.
--    الجداول الخمسة موجودة فعلًا وبها بيانات حية. تشغيله لن يضر
--    (كل شيء IF NOT EXISTS فيصبح no-op) لكنه بلا فائدة.
--    فائدته الوحيدة: إعادة بناء بيئة تطوير جديدة من الصفر.
--
-- ✅ صُحّح ليطابق الـschema الفعلي بعد تدقيق القراءة في 2026-08-19:
--    - contacts: أُضيف office_name (كان موجودًا في قاعدة البيانات ومفقودًا هنا)
--    - contacts: أُزيل created_at (غير موجود فعلًا)
--    - team:     أُزيل updated_at (غير موجود فعلًا)
--
-- المصدر: قراءة مباشرة من ersztjnggcreaiylrswv.supabase.co
-- Sprint 1 / المرحلة 0

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- profiles : صلاحيات المستخدمين (مرتبط بـ auth.users)
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        text not null default 'employee',
  permissions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  public.profiles is 'صلاحيات الموظفين. role=owner يتجاوز كل الصلاحيات.';
comment on column public.profiles.permissions is
  'مفاتيح مستخدمة في الواجهة: add, edit, delete, upload, edit_contact, manage_team';

-- ---------------------------------------------------------------
-- properties : عروض المكتب (المصدر الداخلي)
-- ---------------------------------------------------------------
create table if not exists public.properties (
  id                uuid primary key default gen_random_uuid(),
  type              text not null,
  location          text not null,
  size              text not null,
  price             text not null,
  note              text,
  badge             text default 'عادي',
  phone             text,
  image_url         text,
  status            text not null default 'published',
  source_type       text not null default 'office',
  source_name       text,
  source_url        text,
  source_checked_at date,
  source_consent    boolean not null default false,
  created_by        uuid references auth.users (id) on delete set null,
  created_by_name   text,
  updated_by        uuid references auth.users (id) on delete set null,
  updated_by_name   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on column public.properties.source_type is 'office | marketing | published — يحدد قانونيًا ملكية العرض';

-- ---------------------------------------------------------------
-- team : فريق العمل المعروض في الموقع
-- ---------------------------------------------------------------
create table if not exists public.team (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  title      text,
  phone      text,
  whatsapp   text,
  email      text,
  photo_url  text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
  -- ⚠️ لا يوجد updated_at في هذا الجدول. أي كود يكتبه سيفشل.
);

-- ---------------------------------------------------------------
-- contacts : صف واحد (id=1) لبيانات تواصل المكتب
-- ---------------------------------------------------------------
create table if not exists public.contacts (
  id          integer primary key,
  office_name text,   -- موجود في قاعدة البيانات، ولا يقرأه ولا يكتبه الكود حاليًا
  phone       text,
  whatsapp    text,
  facebook    text,
  maps        text,
  banner_url  text,
  updated_at  timestamptz not null default now(),
  constraint contacts_single_row check (id = 1)
);

-- ---------------------------------------------------------------
-- external_offers : عروض خارجية مرصودة آليًا (موجود مسبقًا)
-- ---------------------------------------------------------------
create table if not exists public.external_offers (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,
  location      text not null,
  size          text not null,
  price         text not null default 'السعر عند التواصل',
  note          text,
  source_name   text not null,
  source_url    text not null unique,
  checked_at    date not null default current_date,
  status        text not null default 'published',
  quality_score integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists external_offers_status_checked_idx
  on public.external_offers (status, checked_at desc);
