-- 0006_rls_policies.sql
--
-- (كان 0005 سابقًا. أُعيدت كتابته بالكامل ليطابق الـschema الفعلي.)
--
-- الغرض: المفتاح العام منشور داخل حزمة JavaScript بحكم التصميم،
-- فالحماية الحقيقية الوحيدة هي RLS.
--
-- الأعمدة المستخدمة هنا — كلها متحقَّق من وجودها:
--   properties.deleted_at   <- يضيفه 0005 (شرط: نفّذ 0005 قبل هذا الملف)
--   properties.status       <- موجود، ومعيّر بـ 0002
--   team.is_visible         <- موجود أصلًا (لا يُستخدم deleted_at لأنه غير موجود)
--   external_offers.status  <- موجود (لا يُستخدم deleted_at لأنه غير موجود)
--   leads.deleted_at        <- جزء من تعريف الجدول في 0003
--
-- ⚠️ ترتيب إلزامي: 0002 ثم 0003 ثم 0004 ثم 0005 ثم هذا الملف.
--    تنفيذه قبل 0002 يُخفي العروض الثلاثة (لأن حالتها 'متاح' لا 'published').
--    تنفيذه قبل 0005 يفشل (لأن properties.deleted_at لن يكون موجودًا).
--
-- تحقق مسبق: profiles = 5 صفوف و auth.users = 5 — فلا خطر إقفال للإدارة.
--
-- Sprint 1

-- ===============================================================
-- دوال مساعدة (SECURITY DEFINER لتتجاوز RLS على profiles)
-- ===============================================================
create or replace function public.current_profile_role()
returns text
language sql stable security definer
set search_path = public
as $fn$
  select role from public.profiles where id = auth.uid();
$fn$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $fn$
  select exists (select 1 from public.profiles where id = auth.uid());
$fn$;

create or replace function public.has_perm(perm text)
returns boolean
language sql stable security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and (p.role = 'owner' or coalesce((p.permissions ->> perm)::boolean, false))
  );
$fn$;

comment on function public.has_perm(text) is
  'نفس منطق can() في الواجهة: owner يتجاوز كل شيء، وإلا يُقرأ المفتاح من permissions.';

-- ===============================================================
-- تفعيل RLS
-- ===============================================================
alter table public.profiles        enable row level security;
alter table public.properties      enable row level security;
alter table public.team            enable row level security;
alter table public.contacts        enable row level security;
alter table public.external_offers enable row level security;
alter table public.leads           enable row level security;
alter table public.audit_log       enable row level security;

-- ===============================================================
-- profiles : كل مستخدم يقرأ صفّه فقط. لا كتابة من العميل.
-- الحسابات الخمسة الموجودة لا تُمس — هذه قراءة فقط.
-- ===============================================================
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- ===============================================================
-- properties
-- ===============================================================
drop policy if exists properties_public_read  on public.properties;
drop policy if exists properties_staff_read   on public.properties;
drop policy if exists properties_staff_insert on public.properties;
drop policy if exists properties_staff_update on public.properties;

create policy properties_public_read on public.properties
  for select to anon, authenticated
  using (status = 'published' and deleted_at is null);

create policy properties_staff_read on public.properties
  for select to authenticated
  using (public.is_staff());

create policy properties_staff_insert on public.properties
  for insert to authenticated
  with check (public.has_perm('add'));

create policy properties_staff_update on public.properties
  for update to authenticated
  using (public.has_perm('edit') or public.has_perm('delete'))
  with check (public.has_perm('edit') or public.has_perm('delete'));

-- ⛔ لا سياسة DELETE — الحذف النهائي ممنوع. الحذف يتم بـ UPDATE.
revoke delete on public.properties from anon, authenticated;

-- ===============================================================
-- team
-- ⚠️ لا إشارة إلى deleted_at ولا updated_at — العمودان غير موجودين.
--    الإخفاء عبر is_visible وهو موجود أصلًا.
-- ===============================================================
drop policy if exists team_public_read  on public.team;
drop policy if exists team_staff_read   on public.team;
drop policy if exists team_staff_write  on public.team;
drop policy if exists team_staff_update on public.team;

create policy team_public_read on public.team
  for select to anon, authenticated
  using (is_visible = true);

create policy team_staff_read on public.team
  for select to authenticated
  using (public.is_staff());

create policy team_staff_write on public.team
  for insert to authenticated
  with check (public.has_perm('manage_team'));

create policy team_staff_update on public.team
  for update to authenticated
  using (public.has_perm('manage_team'))
  with check (public.has_perm('manage_team'));

revoke delete on public.team from anon, authenticated;

-- ===============================================================
-- contacts : بيانات المكتب العامة (صف واحد id=1)
-- ===============================================================
drop policy if exists contacts_public_read  on public.contacts;
drop policy if exists contacts_staff_write  on public.contacts;
drop policy if exists contacts_staff_update on public.contacts;

create policy contacts_public_read on public.contacts
  for select to anon, authenticated
  using (true);

create policy contacts_staff_write on public.contacts
  for insert to authenticated
  with check (public.has_perm('edit_contact'));

create policy contacts_staff_update on public.contacts
  for update to authenticated
  using (public.has_perm('edit_contact'))
  with check (public.has_perm('edit_contact'));

revoke delete on public.contacts from anon, authenticated;

-- ===============================================================
-- external_offers
-- ⚠️ لا إشارة إلى deleted_at — العمود غير موجود ولن يُضاف.
--    الصفوف الثمانية المنشورة تبقى ظاهرة، والمؤرشفة تبقى كما هي بلا مساس.
--    الكتابة حصرًا للعامل عبر service_role.
-- ===============================================================
drop policy if exists "Public can read published external offers" on public.external_offers;
drop policy if exists external_offers_public_read on public.external_offers;
drop policy if exists external_offers_staff_read  on public.external_offers;

create policy external_offers_public_read on public.external_offers
  for select to anon, authenticated
  using (status = 'published');

create policy external_offers_staff_read on public.external_offers
  for select to authenticated
  using (public.is_staff());

revoke insert, update, delete on public.external_offers from anon, authenticated;

-- ===============================================================
-- leads : أهم سياسة خصوصية في المشروع
--   الزائر المجهول: إدخال فقط. لا يقرأ أي طلب — ولا حتى طلبه هو.
-- ===============================================================
drop policy if exists leads_public_insert on public.leads;
drop policy if exists leads_staff_read    on public.leads;
drop policy if exists leads_staff_update  on public.leads;

create policy leads_public_insert on public.leads
  for insert to anon, authenticated
  with check (
    lead_type in ('marketing_request','service_request','property_inquiry','search_request')
    and length(btrim(name))  between 2 and 120
    and length(btrim(phone)) between 6 and 30
    and coalesce(length(request_text), 0) <= 4000
    and status = 'new'          -- الزائر لا يختار حالة الطلب
    and assigned_to is null     -- ولا يسند الطلب لأحد
    and deleted_at is null
  );

create policy leads_staff_read on public.leads
  for select to authenticated
  using (public.is_staff());

create policy leads_staff_update on public.leads
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke delete on public.leads from anon, authenticated;

-- ===============================================================
-- audit_log : قراءة للمالك فقط، ولا كتابة من العميل.
-- (fn_audit يكتب بـ SECURITY DEFINER فيتجاوز هذه السياسات)
-- ===============================================================
drop policy if exists audit_log_owner_read on public.audit_log;

create policy audit_log_owner_read on public.audit_log
  for select to authenticated
  using (public.current_profile_role() = 'owner');

revoke insert, update, delete on public.audit_log from anon, authenticated;
