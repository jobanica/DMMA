-- ============================================================================
-- RPCs and views: enrollment, dangling-in detection, live occupancy.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- complete_enrollment: called by a teacher from the client at the end of the
-- enrollment flow (spec §6.1). Atomically records consent + stores the face
-- template + marks enrollment complete. SECURITY DEFINER so it can write the
-- protected face_template column and the consent audit row in one shot, while
-- still keying strictly off the caller's own auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.complete_enrollment(
  p_template       jsonb,
  p_policy_version text,
  p_ip_address     text default null
)
returns public.teachers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher public.teachers;
begin
  select * into v_teacher
  from public.teachers
  where auth_user_id = auth.uid()
  for update;

  if v_teacher.id is null then
    raise exception 'no teacher record for current user';
  end if;

  update public.teachers
     set face_template = coalesce(p_template, face_template),
         consent_at    = coalesce(consent_at, now()),
         enrolled_at   = now()
   where id = v_teacher.id
   returning * into v_teacher;

  insert into public.consent_records (teacher_id, policy_version, ip_address)
  values (v_teacher.id, p_policy_version, p_ip_address);

  return v_teacher;
end;
$$;

grant execute on function public.complete_enrollment(jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_my_face_template: the ONLY way the teacher client can read back its own
-- template (needed by face-api.js at scan time). Returns just the caller's
-- vector; never anyone else's. face_template SELECT is otherwise revoked.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_face_template()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select face_template
  from public.teachers
  where auth_user_id = auth.uid();
$$;

grant execute on function public.get_my_face_template() to authenticated;

-- ---------------------------------------------------------------------------
-- find_dangling_ins: used by the auto-close-dangling Edge Function. Returns
-- (teacher_id, room_id) pairs whose most recent event is 'in' and older than
-- the cutoff — i.e. someone timed in but never timed out.
-- ---------------------------------------------------------------------------
create or replace function public.find_dangling_ins(cutoff timestamptz)
returns table (teacher_id uuid, room_id uuid)
language sql
stable
as $$
  with latest as (
    select distinct on (l.teacher_id, l.room_id)
           l.teacher_id, l.room_id, l.event_type
    from public.attendance_logs l
    where l.scanned_at < cutoff
    order by l.teacher_id, l.room_id, l.scanned_at desc
  )
  select latest.teacher_id, latest.room_id
  from latest
  where latest.event_type = 'in';
$$;

-- ---------------------------------------------------------------------------
-- live_occupancy: current room occupancy for the admin dashboard (spec §6.3).
-- A teacher is "in" a room when their most recent event there is 'in'.
-- Exposed as a security-barrier view; RLS on the underlying tables + the
-- is_admin() checks in policies mean only admins can meaningfully read it.
-- ---------------------------------------------------------------------------
create or replace view public.live_occupancy
with (security_invoker = true)
as
  with latest as (
    select distinct on (l.teacher_id, l.room_id)
           l.teacher_id, l.room_id, l.event_type, l.scanned_at, l.status
    from public.attendance_logs l
    order by l.teacher_id, l.room_id, l.scanned_at desc
  )
  select
    latest.teacher_id,
    t.full_name,
    t.employee_id,
    latest.room_id,
    r.room_code,
    r.building,
    latest.scanned_at as since,
    latest.status
  from latest
  join public.teachers t on t.id = latest.teacher_id
  join public.rooms r    on r.id = latest.room_id
  where latest.event_type = 'in';
