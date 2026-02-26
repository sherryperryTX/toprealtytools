-- Usage tracking table for TopRealtyTools beta
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_email TEXT,
  tool TEXT NOT NULL, -- 'snitch-mitch' or 'appraiser'
  message_type TEXT NOT NULL DEFAULT 'chat', -- 'chat', 'photo', 'voice'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user and month
CREATE INDEX idx_usage_user_month ON usage_tracking (user_id, created_at);

-- Enable RLS
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY "Users can view own usage" ON usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own usage
CREATE POLICY "Users can insert own usage" ON usage_tracking
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- View for easy monthly usage check
CREATE OR REPLACE VIEW user_monthly_usage AS
SELECT
  user_id,
  COUNT(*) as message_count,
  DATE_TRUNC('month', NOW()) as month_start
FROM usage_tracking
WHERE created_at >= DATE_TRUNC('month', NOW())
GROUP BY user_id;

-- ===== User Settings (admin-managed) =====
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  unlimited BOOLEAN DEFAULT FALSE,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can read their own settings
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

-- ===== Admin Users Table =====
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID NOT NULL REFERENCES auth.users(id) PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Admins can read their own admin status
CREATE POLICY "Users can check own admin status" ON admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- Admin policies for user_settings: admins can do everything
CREATE POLICY "Admins can manage user settings" ON user_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

-- Admin policies for usage_tracking: admins can view all usage
CREATE POLICY "Admins can view all usage" ON usage_tracking
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

-- ===== IMPORTANT: After running this SQL, manually insert yourself as admin =====
-- Run this AFTER creating your account and replacing YOUR_USER_ID:
-- INSERT INTO admin_users (user_id) VALUES ('YOUR_USER_ID_HERE');
