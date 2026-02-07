
-- Allow maintenance users to view any profile (needed for downloading reports with student details)
CREATE POLICY "Maintenance can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'maintenance'::app_role));
