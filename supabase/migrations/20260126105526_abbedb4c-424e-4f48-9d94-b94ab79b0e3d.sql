-- Create storage bucket for issue reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-reports', 'issue-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for issue-reports bucket
CREATE POLICY "Anyone can view issue reports"
ON storage.objects
FOR SELECT
USING (bucket_id = 'issue-reports');

CREATE POLICY "Authenticated users can upload issue reports"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'issue-reports' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own issue reports"
ON storage.objects
FOR DELETE
USING (bucket_id = 'issue-reports' AND auth.uid()::text = (storage.foldername(name))[1]);