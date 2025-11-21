-- Migration to ensure UserServices has UNIQUE constraint on (user_id, service_id)
-- This prevents duplicate subscriptions for the same user+service pair

-- First, check if the constraint already exists
DO $$
BEGIN
  -- Try to add the constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_service_unique'
  ) THEN
    -- Remove any duplicate entries first (keep the most recent)
    DELETE FROM user_services a
    USING user_services b
    WHERE a.user_id = b.user_id
      AND a.service_id = b.service_id
      AND a.created_at < b.created_at;

    -- Now add the unique constraint
    ALTER TABLE user_services
    ADD CONSTRAINT user_service_unique UNIQUE (user_id, service_id);
    
    RAISE NOTICE 'Unique constraint user_service_unique added successfully';
  ELSE
    RAISE NOTICE 'Unique constraint user_service_unique already exists';
  END IF;
END $$;