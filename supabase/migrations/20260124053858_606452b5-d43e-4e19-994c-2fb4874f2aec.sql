-- Add new profile fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS degree text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS registration_number text,
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false;

-- Add resolved_image_url to issues table
ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS resolved_image_url text;

-- Update issue_category enum to add new categories
ALTER TYPE public.issue_category ADD VALUE IF NOT EXISTS 'fire_safety';
ALTER TYPE public.issue_category ADD VALUE IF NOT EXISTS 'civil_work';
ALTER TYPE public.issue_category ADD VALUE IF NOT EXISTS 'air_emission';
ALTER TYPE public.issue_category ADD VALUE IF NOT EXISTS 'water';