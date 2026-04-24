create or replace function public.planner_restore_snapshot_row(
  p_entity_type text,
  p_snapshot jsonb,
  p_workspace_root_id uuid,
  p_actor_profile_id uuid,
  p_change_set_id uuid,
  p_restored_from_version_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_table text;
  insert_columns text;
  update_columns text;
  row_snapshot jsonb;
begin
  current_table := public.planner_entity_current_table(p_entity_type);

  if current_table is null then
    raise exception 'UNSUPPORTED_ENTITY_TYPE';
  end if;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into insert_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = current_table;

  select string_agg(
    format('%1$s = excluded.%1$s', quote_ident(column_name)),
    ', ' order by ordinal_position
  )
  into update_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = current_table
    and column_name <> 'id';

  execute format(
    $sql$
      with incoming as (
        select *
        from jsonb_populate_record(
          null::public.%1$I,
          (
            coalesce($1, '{}'::jsonb)
            || jsonb_build_object(
              'workspace_root_id', $2,
              'lock_version', coalesce((
                select current_row.lock_version + 1
                from public.%1$I current_row
                where current_row.id = (($1 ->> 'id'))::uuid
              ), 1),
              'updated_at', timezone('utc'::text, now()),
              'deleted_at', null,
              'deleted_by_profile_id', null,
              'restored_from_version_id', $3,
              'last_change_set_id', $4
            )
          )
        )
      ),
      upserted as (
        insert into public.%1$I (%2$s)
        select %2$s
        from incoming
        on conflict (id) do update
        set %3$s
        returning row_to_json(%1$I.*)::jsonb
      )
      select *
      from upserted
    $sql$,
    current_table,
    insert_columns,
    update_columns
  )
  into row_snapshot
  using p_snapshot, p_workspace_root_id, p_restored_from_version_id, p_change_set_id;

  if row_snapshot is null then
    raise exception 'RESTORE_FAILED';
  end if;

  return row_snapshot;
end;
$$;
