-- Create table for storing downloaded reports
CREATE TABLE public.downloaded_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  issue_category text NOT NULL,
  location text,
  issue_status text NOT NULL,
  downloaded_at timestamp with time zone NOT NULL DEFAULT now(),
  file_url text NOT NULL,
  file_name text NOT NULL
);

-- Enable RLS
ALTER TABLE public.downloaded_reports ENABLE ROW LEVEL SECURITY;

-- Students can only see their own downloaded reports
CREATE POLICY "Users can view their own downloaded reports"
ON public.downloaded_reports
FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'maintenance'::app_role));

-- Users can insert their own reports
CREATE POLICY "Users can insert their own downloaded reports"
ON public.downloaded_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reports
CREATE POLICY "Users can delete their own downloaded reports"
ON public.downloaded_reports
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_downloaded_reports_user_id ON public.downloaded_reports(user_id);
CREATE INDEX idx_downloaded_reports_issue_id ON public.downloaded_reports(issue_id);