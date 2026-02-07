
-- Ensure users can update/overwrite their own reports in issue-reports bucket (needed for upsert)
CREATE POLICY "Authenticated users can update issue reports"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'issue-reports' AND auth.role() = 'authenticated');
