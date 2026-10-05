-- AI60 hall-ticket backend. Paste into Supabase → SQL Editor → Run.
-- Design: the table has RLS enabled and NO policies, so the public anon key cannot read or write it
-- directly. Everything goes through security-definer functions that expose only non-PII columns.

create table if not exists public.registrations (
  id          bigint generated always as identity primary key,
  seat        int  not null unique,
  code        text not null unique,
  full_name   text not null check (char_length(full_name) between 2 and 80),
  email       text not null,
  phone       text not null check (phone ~ '^[6-9][0-9]{9}$'),
  college     text not null check (char_length(college) between 2 and 80),
  branch      text not null check (branch in ('CSE','IT','ECE','EEE','MECH','CIVIL','OTHER')),
  grad_year   int  not null check (grad_year between 2025 and 2030),
  referred_by text references public.registrations(code),
  source      text not null default 'direct'
              check (source in ('captain','referral','club','linkedin','instagram','email','bot','direct')),
  campaign    text check (char_length(campaign) <= 40),
  created_at  timestamptz not null default now()
);

create unique index if not exists registrations_email_key on public.registrations (lower(email));
create unique index if not exists registrations_phone_key on public.registrations (phone);
create index if not exists registrations_referred_by_idx on public.registrations (referred_by);

alter table public.registrations enable row level security;

create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;
-- Set your organiser key (used by the dashboard's CSV export):
-- insert into public.app_secrets values ('admin_key', 'choose-a-long-random-string')
--   on conflict (name) do update set value = excluded.value;

-- "Priya Sharma" -> "Priya S."
create or replace function public.display_name(full_name text) returns text
language sql immutable as $$
  select case
    when array_length(regexp_split_to_array(trim(full_name), '\s+'), 1) > 1
      then initcap(split_part(trim(full_name), ' ', 1)) || ' ' ||
           upper(left((regexp_split_to_array(trim(full_name), '\s+'))[array_length(regexp_split_to_array(trim(full_name), '\s+'), 1)], 1)) || '.'
    else initcap(trim(full_name))
  end
$$;

create or replace function public.public_seats()
returns table (seat int, code text, name text, college text, branch text, grad_year int,
               referred_by text, source text, campaign text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select r.seat, r.code, public.display_name(r.full_name), r.college, r.branch, r.grad_year,
         r.referred_by, r.source, r.campaign, r.created_at
  from public.registrations r
  order by r.seat
$$;

create or replace function public.register(
  p_name text, p_email text, p_phone text, p_college text, p_branch text, p_grad_year int,
  p_referred_by text default null, p_source text default 'direct', p_campaign text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_row public.registrations;
  v_code text;
  v_chars constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_ref text := null;
  v_source text := coalesce(p_source, 'direct');
begin
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Please enter a valid 10-digit mobile number'; end if;

  select * into v_row from public.registrations
   where lower(email) = lower(p_email) or phone = p_phone limit 1;
  if found then
    return json_build_object('seat', v_row.seat, 'code', v_row.code, 'name', public.display_name(v_row.full_name),
      'college', v_row.college, 'branch', v_row.branch, 'grad_year', v_row.grad_year, 'referred_by', v_row.referred_by,
      'source', v_row.source, 'campaign', v_row.campaign, 'created_at', v_row.created_at, 'existing', true);
  end if;

  if p_referred_by is not null and exists (select 1 from public.registrations where code = upper(p_referred_by)) then
    v_ref := upper(p_referred_by);
    v_source := 'referral';
  elsif v_source = 'referral' then
    v_source := 'direct';
  end if;

  -- Serialise seat allocation so two students never get the same seat number.
  perform pg_advisory_xact_lock(60);

  loop
    v_code := 'AI60-';
    for i in 1..4 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.registrations where code = v_code);
  end loop;

  insert into public.registrations (seat, code, full_name, email, phone, college, branch, grad_year,
                                    referred_by, source, campaign)
  values ((select coalesce(max(seat), 0) + 1 from public.registrations), v_code, trim(p_name), lower(trim(p_email)),
          p_phone, trim(p_college), p_branch, p_grad_year, v_ref, v_source, nullif(upper(trim(p_campaign)), ''))
  returning * into v_row;

  return json_build_object('seat', v_row.seat, 'code', v_row.code, 'name', public.display_name(v_row.full_name),
    'college', v_row.college, 'branch', v_row.branch, 'grad_year', v_row.grad_year, 'referred_by', v_row.referred_by,
    'source', v_row.source, 'campaign', v_row.campaign, 'created_at', v_row.created_at, 'existing', false);
end
$$;

-- "Lost my ticket": needs BOTH phone and email to match.
create or replace function public.find_ticket(p_phone text, p_email text)
returns table (seat int, code text, name text, college text, branch text, grad_year int,
               referred_by text, source text, campaign text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select r.seat, r.code, public.display_name(r.full_name), r.college, r.branch, r.grad_year,
         r.referred_by, r.source, r.campaign, r.created_at
  from public.registrations r
  where r.phone = p_phone and lower(r.email) = lower(p_email)
$$;

-- Organiser CSV export (WhatsApp reminder lists, certificates). Requires the admin key.
create or replace function public.admin_export(p_key text)
returns table (seat int, code text, name text, full_name text, email text, phone text, college text, branch text,
               grad_year int, referred_by text, source text, campaign text, created_at timestamptz)
language plpgsql security definer set search_path = public stable as $$
begin
  -- Qualified: "name" alone would clash with this function's output column of the same name.
  if not exists (select 1 from public.app_secrets s where s.name = 'admin_key' and s.value = p_key) then
    raise exception 'Invalid organiser key';
  end if;
  return query
    select r.seat, r.code, public.display_name(r.full_name), r.full_name, r.email, r.phone, r.college, r.branch,
           r.grad_year, r.referred_by, r.source, r.campaign, r.created_at
    from public.registrations r order by r.seat;
end
$$;

revoke all on public.registrations, public.app_secrets from anon, authenticated;
grant execute on function public.public_seats(), public.register(text,text,text,text,text,int,text,text,text),
  public.find_ticket(text,text), public.admin_export(text) to anon, authenticated;

-- ===========================================================================
-- Live workshop room (event log). Attendees post through a room token obtained
-- with their hall-ticket code + phone; the host posts with the organiser key.
-- ===========================================================================

create table if not exists public.live_events (
  id         bigint generated always as identity primary key,
  who        text not null,
  kind       text not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists live_events_who_time_idx on public.live_events (who, created_at);
alter table public.live_events enable row level security;

create table if not exists public.live_tokens (
  token      text primary key,
  code       text not null references public.registrations(code),
  created_at timestamptz not null default now()
);
alter table public.live_tokens enable row level security;

create or replace function public.live_join(p_code text, p_phone text) returns text
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not exists (select 1 from public.registrations where code = upper(p_code) and phone = p_phone) then
    raise exception 'No hall ticket matches that code and number';
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.live_tokens (token, code) values (v_token, upper(p_code));
  return v_token;
end
$$;

create or replace function public.live_post(p_token text, p_kind text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_reg public.registrations;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  select t.code into v_code from public.live_tokens t where t.token = p_token;
  if v_code is null then raise exception 'Join the room first'; end if;
  if p_kind not in ('join','check','stuck','unstuck','react','vote','ask','upvote','ship','answer') then
    raise exception 'Unknown event';
  end if;
  if length(v_payload::text) > 2000 then raise exception 'Too long'; end if;
  if (select count(*) from public.live_events e where e.who = v_code and e.created_at > now() - interval '1 minute') >= 40 then
    raise exception 'Slow down a little';
  end if;

  -- Identity fields come from the registration, never from the client.
  select * into v_reg from public.registrations r where r.code = v_code;
  if p_kind in ('join', 'ask', 'ship') then
    v_payload := v_payload || jsonb_build_object('name', public.display_name(v_reg.full_name), 'college', v_reg.college);
  end if;
  if p_kind in ('join', 'ask') then
    v_payload := v_payload || jsonb_build_object(
      'gold', (select count(*) >= 3 from public.registrations r where r.referred_by = v_code));
  end if;
  if p_kind = 'join' then
    v_payload := v_payload || jsonb_build_object('branch', v_reg.branch);
  end if;

  insert into public.live_events (who, kind, payload) values (v_code, p_kind, v_payload);
end
$$;

create or replace function public.live_host(p_key text, p_kind text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.app_secrets s where s.name = 'admin_key' and s.value = p_key) then
    raise exception 'Invalid organiser key';
  end if;
  if p_kind not in ('step','poll','poll_close','quiz','answered','resolve','announce','reset') then
    raise exception 'Unknown host event';
  end if;
  insert into public.live_events (who, kind, payload) values ('host', p_kind, coalesce(p_payload, '{}'::jsonb));
end
$$;

create or replace function public.live_since(p_after bigint)
returns table (id bigint, who text, kind text, payload jsonb, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select e.id, e.who, e.kind, e.payload, e.created_at
  from public.live_events e
  where e.id > p_after
  order by e.id
  limit 2000
$$;

-- WhatsApp bot conversation state (written only by api/whatsapp.ts with the service-role key).
create table if not exists public.wa_sessions (
  phone      text primary key,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.wa_sessions enable row level security;

revoke all on public.live_events, public.live_tokens, public.wa_sessions from anon, authenticated;
grant execute on function public.live_join(text,text), public.live_post(text,text,jsonb),
  public.live_host(text,text,jsonb), public.live_since(bigint) to anon, authenticated;
