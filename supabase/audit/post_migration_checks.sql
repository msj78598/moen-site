-- post_migration_checks.sql
-- شغّله في Supabase SQL Editor بعد تنفيذ الترحيلات. كله SELECT — لا يعدّل شيئًا.
-- كل سطر يجب أن يكون PASS. أي FAIL توقّف وأرسله لي.

with checks as (

  -- 1) العروض الثلاثة موجودة وحالتها منشورة
  select 1 as n, 'العروض الثلاثة موجودة ومنشورة' as check_name,
         count(*)::text || ' عرض منشور' as actual,
         case when count(*) = 3 then 'PASS' else 'FAIL' end as result
    from public.properties
   where status = 'published' and deleted_at is null

  union all
  -- 2) لم يُفقد أي عرض مهما كانت حالته
  select 2, 'إجمالي properties لم ينقص',
         count(*)::text || ' صف',
         case when count(*) >= 3 then 'PASS' else 'FAIL' end
    from public.properties

  union all
  -- 3) القيم الأصلية محفوظة
  select 3, 'legacy_status حفظ القيم القديمة',
         coalesce(string_agg(distinct legacy_status, ', '), '(فارغ)'),
         case when count(*) filter (where legacy_status is not null) = count(*)
              then 'PASS' else 'FAIL' end
    from public.properties

  union all
  -- 4) لا قيم status خارج المعياري
  select 4, 'كل قيم status معيارية',
         coalesce(string_agg(distinct status, ', '), '(لا صفوف)'),
         case when count(*) filter (
                where status not in ('published','draft','archived','rejected')
              ) = 0 then 'PASS' else 'FAIL' end
    from public.properties

  union all
  -- 5) الحسابات الخمسة
  select 5, 'profiles = 5 حسابات',
         count(*)::text,
         case when count(*) = 5 then 'PASS' else 'FAIL' end
    from public.profiles

  union all
  select 6, 'auth.users = 5 حسابات',
         count(*)::text,
         case when count(*) = 5 then 'PASS' else 'FAIL' end
    from auth.users

  union all
  -- 7) الفريق كما هو
  select 7, 'team = 3 وكلهم ظاهرون',
         count(*)::text || ' صف، ظاهر منهم '
           || count(*) filter (where is_visible)::text,
         case when count(*) = 3 and count(*) filter (where is_visible) = 3
              then 'PASS' else 'FAIL' end
    from public.team

  union all
  -- 8) external_offers لم تتغير: 8 منشورة + المؤرشفة كما هي
  select 8, 'external_offers المنشورة = 8',
         count(*)::text,
         case when count(*) = 8 then 'PASS' else 'FAIL' end
    from public.external_offers where status = 'published'

  union all
  select 9, 'external_offers المؤرشفة لم تُمس',
         count(*)::text || ' مؤرشف',
         case when count(*) >= 78 then 'PASS' else 'راجع' end
    from public.external_offers where status = 'archived'

  union all
  -- 10) بيانات التواصل
  select 10, 'contacts صف واحد',
         count(*)::text,
         case when count(*) = 1 then 'PASS' else 'FAIL' end
    from public.contacts

  union all
  -- 11) الجداول الجديدة أُنشئت
  select 11, 'جدول leads أُنشئ',
         count(*)::text || ' جدول',
         case when count(*) = 1 then 'PASS' else 'FAIL' end
    from information_schema.tables
   where table_schema = 'public' and table_name = 'leads'

  union all
  select 12, 'جدول audit_log أُنشئ',
         count(*)::text || ' جدول',
         case when count(*) = 1 then 'PASS' else 'FAIL' end
    from information_schema.tables
   where table_schema = 'public' and table_name = 'audit_log'

  union all
  -- 13) عمود الحذف الناعم أُضيف لـ properties فقط
  select 13, 'properties.deleted_at موجود',
         count(*)::text,
         case when count(*) = 1 then 'PASS' else 'FAIL' end
    from information_schema.columns
   where table_schema = 'public' and table_name = 'properties' and column_name = 'deleted_at'

  union all
  select 14, 'team لم يُضف له deleted_at (مقصود)',
         count(*)::text,
         case when count(*) = 0 then 'PASS' else 'FAIL' end
    from information_schema.columns
   where table_schema = 'public' and table_name = 'team' and column_name = 'deleted_at'

  union all
  -- 15) RLS مفعّلة على كل الجداول
  select 15, 'RLS مفعّلة على الجداول السبعة',
         count(*) filter (where c.relrowsecurity)::text || ' من ' || count(*)::text,
         case when count(*) filter (where c.relrowsecurity) = count(*)
              then 'PASS' else 'FAIL' end
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname in ('properties','team','contacts','profiles','external_offers','leads','audit_log')

  union all
  -- 16) لا جدول محكوم بلا سياسات
  select 16, 'كل جدول عليه سياسة واحدة على الأقل',
         string_agg(c.relname, ', '),
         case when count(*) = 0 then 'PASS' else 'FAIL' end
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policy p on p.polrelid = c.oid
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname in ('properties','team','contacts','profiles','external_offers','leads','audit_log')
   group by c.relname, c.relrowsecurity
  having count(p.polname) = 0

  union all
  -- 17) ⚠️ الأهم: هل بقيت صلاحية حذف أو كتابة للعامة؟
  select 17, 'anon لا يملك INSERT/UPDATE/DELETE على الجداول الحساسة',
         coalesce(string_agg(table_name || ':' || privilege_type, ', '), 'لا شيء'),
         case when count(*) = 0 then 'PASS' else 'FAIL' end
    from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee = 'anon'
     and privilege_type in ('INSERT','UPDATE','DELETE')
     and table_name in ('properties','team','contacts','profiles','external_offers','audit_log')

  union all
  -- 18) anon يستطيع الإدخال في leads فقط (نموذج الطلبات)
  select 18, 'anon يملك INSERT على leads',
         coalesce(string_agg(privilege_type, ', '), 'لا شيء'),
         case when count(*) >= 1 then 'PASS' else 'FAIL' end
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'
     and table_name = 'leads' and privilege_type = 'INSERT'

  union all
  -- 19) DELETE منزوع عن الجميع
  select 19, 'DELETE منزوع عن anon و authenticated',
         coalesce(string_agg(distinct table_name, ', '), 'لا شيء'),
         case when count(*) = 0 then 'PASS' else 'FAIL' end
    from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee in ('anon','authenticated')
     and privilege_type = 'DELETE'
     and table_name in ('properties','team','contacts','leads','external_offers','audit_log')
)
select n as "#", check_name as "الفحص", actual as "القيمة", result as "النتيجة"
  from checks order by n;


-- ===============================================================
-- فحص إضافي: محاكاة ما سيراه زائر الموقع (دور anon)
-- إن أعاد هذا 3 عروض و 8 عروض خارجية و 3 موظفين، فالموقع سليم.
-- ===============================================================
set local role anon;

select 'ما يراه الزائر' as scope,
       (select count(*) from public.properties)      as properties,
       (select count(*) from public.external_offers) as external_offers,
       (select count(*) from public.team)            as team,
       (select count(*) from public.contacts)        as contacts;

reset role;
