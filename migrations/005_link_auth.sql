-- Add auth_user_id column to profiles for linking to Supabase Auth
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- Create index for auth_user_id lookups
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user ON profiles(auth_user_id);
