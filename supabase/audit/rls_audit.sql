-- rls_audit.sql
-- شغّل هذه الاستعلامات في Supabase SQL Editor وأرسل لي النتائج.
-- كلها SELECT فقط — لا تعدّل أي شيء.

-- ===============================================================
-- 1) هل RLS مفعّلة على كل جدول؟  (rowsecurity = false يعني الجدول مكشوف)
-- ===============================================================
select
  c.relname                as table_name,
  c.relrowsecurity         as rls_enabled,
  c.relforcerowsecurity    as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- ===============================================================
-- 2) كل السياسات الموجودة فعليًا
-- ===============================================================
select
  tablename,
  policyname,
  roles,
  cmd,
  qual        as using_expression,
  with_check  as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- ===============================================================
-- 3) ⚠️ الأخطر: ما الصلاحيات الممنوحة لـ anon و authenticated مباشرة؟
--    وجود INSERT/UPDATE/DELETE لـ anon على properties = ثغرة مفتوحة.
-- ===============================================================
select
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- ===============================================================
-- 4) جدول بلا أي سياسة + RLS مفعّلة = مقفل كليًا (قد يكسر الموقع)
--    جدول بلا أي سياسة + RLS معطّلة  = مفتوح كليًا (ثغرة)
-- ===============================================================
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.polname) as policy_count,
  case
    when not c.relrowsecurity then 'مفتوح — RLS معطّلة'
    when count(p.polname) = 0 then 'مقفل — RLS مفعّلة بلا سياسات'
    else 'محكوم بسياسات'
  end as verdict
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by verdict, table_name;

-- ===============================================================
-- 5) ما القيم الفعلية الموجودة في status؟
--    شغّل هذا قبل 0002 لأعرف أي قيم عربية تحتاج تحويلًا.
-- ===============================================================
select 'properties' as src, status, count(*) from public.properties group by status
union all
select 'external_offers', status, count(*) from public.external_offers group by status
order by src, status;

-- ===============================================================
-- 6) بعد تنفيذ 0002 — راجع ما تحوّل إلى draft (أي ما اختفى من الموقع)
-- ===============================================================
-- select id, type, location, legacy_status, status
--   from public.properties
--  where status = 'draft' and legacy_status is distinct from 'draft';

-- ===============================================================
-- 7) buckets التخزين وسياساتها
-- ===============================================================
select id, name, public from storage.buckets order by name;

select policyname, cmd, roles
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
