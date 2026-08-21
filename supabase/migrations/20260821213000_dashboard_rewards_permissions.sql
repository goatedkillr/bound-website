create table if not exists public.dashboard_connect_rewards (
  user_id text primary key check (user_id ~ '^\d{17,20}$'),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null default 10000 check (amount = 10000),
  claimed_at timestamptz not null default now(),
  dm_status text not null default 'pending' check (dm_status in ('pending','sent','failed','unavailable')),
  dm_attempted_at timestamptz,
  unique (auth_user_id)
);

comment on table public.dashboard_connect_rewards is
  'One-time global economy reward for verified Discord users who connect to the Bound dashboard.';

alter table public.dashboard_connect_rewards enable row level security;
revoke all on table public.dashboard_connect_rewards from anon, authenticated;
grant select, insert, update on table public.dashboard_connect_rewards to service_role;

create table if not exists public.dashboard_guild_permissions (
  guild_id text not null check (guild_id ~ '^\d{17,20}$'),
  user_id text not null check (user_id ~ '^\d{17,20}$'),
  permissions text[] not null default array['view_dashboard']::text[],
  granted_by text not null check (granted_by ~ '^\d{17,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id),
  check (
    permissions <@ array[
      'view_dashboard',
      'manage_settings',
      'manage_safety',
      'manage_factions',
      'manage_permissions'
    ]::text[]
    and permissions @> array['view_dashboard']::text[]
  )
);

comment on table public.dashboard_guild_permissions is
  'Server-owner delegated Bound dashboard permissions, enforced server-side.';

create index if not exists dashboard_guild_permissions_user_id_idx
  on public.dashboard_guild_permissions (user_id);

alter table public.dashboard_guild_permissions enable row level security;
revoke all on table public.dashboard_guild_permissions from anon, authenticated;
grant select, insert, update, delete on table public.dashboard_guild_permissions to service_role;

create or replace function public.claim_dashboard_connect_reward(
  p_user_id text,
  p_auth_user_id uuid
)
returns table (claimed boolean, balance bigint, amount bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_claimed boolean := false;
  current_balance bigint := 0;
begin
  if p_user_id is null or p_user_id !~ '^\d{17,20}$' or p_auth_user_id is null then
    raise exception 'invalid reward identity';
  end if;

  insert into public.dashboard_connect_rewards (user_id, auth_user_id, amount)
  values (p_user_id, p_auth_user_id, 10000)
  on conflict do nothing
  returning true into was_claimed;

  if was_claimed then
    insert into public.user_balances (user_id, money, updated_at)
    values (p_user_id, 10000, now())
    on conflict (user_id) do update
      set money = public.user_balances.money + 10000,
          updated_at = now();
  end if;

  select ub.money into current_balance
  from public.user_balances ub
  where ub.user_id = p_user_id;

  return query select was_claimed, coalesce(current_balance, 0), 10000::bigint;
end;
$$;

revoke all on function public.claim_dashboard_connect_reward(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_dashboard_connect_reward(text, uuid) to service_role;

