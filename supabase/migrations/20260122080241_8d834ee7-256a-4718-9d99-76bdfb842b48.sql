-- Enable realtime for issues table so students can see status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.issues;