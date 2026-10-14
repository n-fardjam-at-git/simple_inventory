-- Charts with no drop list get one hidden drop so inventory stays size×drop.
insert into public.size_chart_drops (chart_id, code, sort_order)
select c.id, '', 1
from public.size_charts c
where not exists (
  select 1 from public.size_chart_drops d where d.chart_id = c.id
);
