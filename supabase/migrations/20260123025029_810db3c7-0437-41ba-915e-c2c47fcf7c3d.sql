-- Create a function to increment points for a user
CREATE OR REPLACE FUNCTION public.increment_points(user_id uuid, points_to_add integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET points = COALESCE(points, 0) + points_to_add
  WHERE id = user_id;
END;
$$;