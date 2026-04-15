-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Pipeline refresh: drop "Delivered", add "Follow up"
-- New shape: Lead → Quote Sent → Follow up → Booked → Lost
-- Booked becomes the won (closed-won) stage.
-- ════════════════════════════════════════════════════════════════════════════

with pairs as (
  select d.id as del_stage_id, b.id as booked_stage_id
    from stages d
    join stages b on b.pipeline_id = d.pipeline_id and b.name = 'Booked'
    where d.name = 'Delivered'
)
update deals
  set stage_id = pairs.booked_stage_id
  from pairs
  where deals.stage_id = pairs.del_stage_id;

update stages
  set is_won = true,
      probability = 100
  where name = 'Booked';

delete from stages where name = 'Delivered';

insert into stages (pipeline_id, name, position, probability, is_won, is_lost)
select qs.pipeline_id, 'Follow up', 0, 60, false, false
  from stages qs
  where qs.name = 'Quote Sent'
    and not exists (
      select 1 from stages s2
      where s2.pipeline_id = qs.pipeline_id and s2.name = 'Follow up'
    );

with canonical as (
  select id,
         case name
           when 'Lead'       then 0
           when 'Quote Sent' then 1
           when 'Follow up'  then 2
           when 'Booked'     then 3
           when 'Lost'       then 4
           else 100 + position
         end as rank
  from stages
),
ranked as (
  select id, row_number() over (
    partition by (select pipeline_id from stages where stages.id = canonical.id)
    order by rank
  ) - 1 as new_position
  from canonical
)
update stages s
  set position = r.new_position
  from ranked r
  where r.id = s.id;

create or replace function public.seed_default_pipeline()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_pipeline_id uuid;
begin
  insert into public.pipelines (org_id, name, is_default) values (new.id, 'Sales Pipeline', true) returning id into v_pipeline_id;
  insert into public.stages (pipeline_id, name, position, probability, is_won, is_lost) values
    (v_pipeline_id, 'Lead',       0, 15,  false, false),
    (v_pipeline_id, 'Quote Sent', 1, 40,  false, false),
    (v_pipeline_id, 'Follow up',  2, 60,  false, false),
    (v_pipeline_id, 'Booked',     3, 100, true,  false),
    (v_pipeline_id, 'Lost',       4, 0,   false, true);
  return new;
end;
$$;
