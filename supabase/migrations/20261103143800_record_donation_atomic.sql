-- Records a donation and adds its capital in one transaction.
-- Locks the session row so concurrent webhooks cannot race on the balance.
-- Returns 'ok', 'duplicate' (same external_id already recorded), or 'inactive'.

create or replace function public.record_donation(
  p_session_id uuid,
  p_external_id text,
  p_donor_name text,
  p_coins integer,
  p_time_seconds integer,
  p_capital_added integer
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from game_sessions
  where id = p_session_id
  for update;

  if not found or v_status <> 'active' then
    return 'inactive';
  end if;

  begin
    insert into donations (session_id, external_id, donor_name, coins, time_seconds, capital_added)
    values (p_session_id, p_external_id, p_donor_name, p_coins, p_time_seconds, p_capital_added);
  exception when unique_violation then
    return 'duplicate';
  end;

  if p_capital_added > 0 then
    update game_sessions
    set balance = balance + p_capital_added,
        updated_at = now()
    where id = p_session_id;
  end if;

  return 'ok';
end;
$$;

revoke all on function public.record_donation(uuid, text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.record_donation(uuid, text, text, integer, integer, integer) to service_role;
