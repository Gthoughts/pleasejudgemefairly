/*
 * a place for you - Phase 28 migration: video uploads storage policies
 *
 * Enables self-hosted short-form video uploads. A public 'videos'
 * Storage bucket holds the files (created via the API). These policies
 * on storage.objects let any signed-in member upload into that bucket
 * and let everyone read (the bucket is public, but explicit read keeps
 * it clear). Members can delete their OWN uploads.
 *
 * Run this once in the Supabase SQL editor after phase 27.
 */

-- Anyone may read objects in the public 'videos' bucket.
create policy "videos: public read"
  on storage.objects for select
  using (bucket_id = 'videos');

-- Signed-in members may upload into the 'videos' bucket.
create policy "videos: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'videos');

-- Uploaders may delete their own objects (owner = auth.uid()).
create policy "videos: delete own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'videos' and owner = auth.uid());
