-- 0004_audit_log.sql
-- الغرض: سجل تدقيق لا يمكن لأي عميل الكتابة فيه أو تعديله.
-- يُملأ عبر trigger يعمل بـ SECURITY DEFINER — أي أن الصلاحية تأتي من قاعدة البيانات لا من العميل.
-- Sprint 1 / المرحلة 19 (الأساسيات)

create table if not exists public.audit_log (
  id            bigserial primary key,
  occurred_at   timestamptz not null default now(),

  actor_id      uuid,              -- auth.uid() أو NULL للعمليات الآلية
  actor_kind    text not null default 'user',   -- user | agent | system
  actor_name    text,

  action        text not null,     -- insert | update | delete | archive | restore
  target_table  text not null,
  target_id     text,

  before_data   jsonb,
  after_data    jsonb,
  changed_keys  text[],

  status        text not null default 'success', -- success | failure
  error_message text,
  context       jsonb not null default '{}'::jsonb
);

comment on table public.audit_log is
  'سجل تدقيق للقراءة فقط من جهة العميل. ممنوع تخزين مفاتيح أو أسرار أو كلمات مرور.';

create index if not exists audit_log_time_idx   on public.audit_log (occurred_at desc);
create index if not exists audit_log_target_idx on public.audit_log (target_table, target_id, occurred_at desc);
create index if not exists audit_log_actor_idx  on public.audit_log (actor_id, occurred_at desc);

-- ===============================================================
-- قائمة الحقول الحساسة التي لا تُنسخ إلى السجل أبدًا
-- ===============================================================
create or replace function public.fn_audit_redact(payload jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(payload, '{}'::jsonb)
         - 'password' - 'token' - 'access_token' - 'refresh_token'
         - 'apikey'   - 'api_key' - 'service_role_key' - 'secret'
         - 'authorization';
$$;

-- ===============================================================
-- Trigger عام للتدقيق
-- ===============================================================
create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_id     text;
  v_keys   text[];
  v_name   text;
begin
  if tg_op = 'DELETE' then
    v_before := public.fn_audit_redact(to_jsonb(old));
    v_after  := null;
    v_id     := old.id::text;
  elsif tg_op = 'INSERT' then
    v_before := null;
    v_after  := public.fn_audit_redact(to_jsonb(new));
    v_id     := new.id::text;
  else
    v_before := public.fn_audit_redact(to_jsonb(old));
    v_after  := public.fn_audit_redact(to_jsonb(new));
    v_id     := new.id::text;
    select array_agg(key)
      into v_keys
      from jsonb_each(v_after) a(key, value)
     where a.value is distinct from (v_before -> a.key);
    -- تجاهل التحديثات التي لا تغيّر شيئًا سوى الطوابع الزمنية
    if v_keys is null or v_keys <@ array['updated_at'] then
      return new;
    end if;
  end if;

  select p.full_name into v_name
    from public.profiles p
   where p.id = auth.uid();

  insert into public.audit_log (
    actor_id, actor_kind, actor_name,
    action, target_table, target_id,
    before_data, after_data, changed_keys
  ) values (
    auth.uid(),
    case when auth.uid() is null then 'system' else 'user' end,
    v_name,
    lower(tg_op), tg_table_name, v_id,
    v_before, v_after, v_keys
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- ===============================================================
-- تركيب الـ trigger على الجداول الحساسة
-- ===============================================================
do $$
declare t text;
begin
  foreach t in array array['properties','team','contacts','leads','external_offers'] loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$I', t);
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on public.%1$I
         for each row execute function public.fn_audit()', t);
  end loop;
end;
$$;
