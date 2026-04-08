alter table public.team_routine_plans
  drop constraint if exists team_routine_plans_team_id_key;

drop index if exists public.idx_team_routine_plans_project_team;
create unique index if not exists idx_team_routine_plans_project_team
  on public.team_routine_plans (planner_project_id, team_id);

alter table public.team_skill_plans
  drop constraint if exists team_skill_plans_team_id_key;

drop index if exists public.idx_team_skill_plans_project_team;
create unique index if not exists idx_team_skill_plans_project_team
  on public.team_skill_plans (planner_project_id, team_id);

alter table public.team_season_plans
  drop constraint if exists team_season_plans_team_id_key;

drop index if exists public.idx_team_season_plans_project_team;
create unique index if not exists idx_team_season_plans_project_team
  on public.team_season_plans (planner_project_id, team_id);
