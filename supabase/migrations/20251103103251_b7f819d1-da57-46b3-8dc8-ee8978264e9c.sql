-- Пересоздаем функции с SECURITY DEFINER для избежания рекурсии RLS
-- Используем CREATE OR REPLACE вместо DROP

CREATE OR REPLACE FUNCTION public.is_member_of_agency(aid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM memberships m
    WHERE m.agency_id = aid 
      AND m.user_id = auth.uid() 
      AND m.active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_elevated_role(aid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM memberships m
    WHERE m.agency_id = aid
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'team_lead')
      AND COALESCE(m.active, true) = true
  );
$$;