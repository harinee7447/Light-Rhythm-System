-- =====================================================
-- LIGHT RHYTHM MANAGEMENT SYSTEM
-- Supabase PostgreSQL Seed & Migration Data
-- Compliant with SRS.md (FR-01 to FR-06)
-- =====================================================

-- 1. Initial Admin User (password: admin123)
INSERT INTO public.users (id, username, password_hash, role, created_at)
VALUES (
    1,
    'admin',
    '$2a$10$PlWyiv5rqyROPwZ3tXWxLOE3XmVjgoqPacjOOw9yNiV7Sb8lxP7.W',
    'admin',
    NOW()
)
ON CONFLICT (username) DO NOTHING;

-- 2. Daily Schedules (FR-01)
INSERT INTO public.schedules (id, name, period, start_time, end_time, brightness_pct, is_active, created_at, updated_at)
VALUES
    (1, 'Morning Light', 'Morning', '06:00', '10:00', 60, true, NOW(), NOW()),
    (2, 'Day Light', 'Day', '10:00', '18:00', 75, true, NOW(), NOW()),
    (3, 'Night Light', 'Night', '18:00', '06:00', 25, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Light Routines (FR-03)
INSERT INTO public.routines (id, name, period, time, brightness_pct, description, is_active, created_at, updated_at)
VALUES
    (1, 'Morning Rhythm', 'Morning', '06:00', 60, 'Start the day with the scheduled morning light.', true, NOW(), NOW()),
    (2, 'Day Rhythm', 'Day', '10:00', 75, 'Maintain the scheduled daytime brightness.', true, NOW(), NOW()),
    (3, 'Night Rhythm', 'Night', '18:00', 25, 'Reduce brightness according to the night schedule.', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Initial System Settings (FR-04)
INSERT INTO public.system_settings (key, value, updated_at)
VALUES
    ('system_mode', 'AUTOMATIC', NOW()),
    ('override_brightness', '-1', NOW()),
    ('auto_adjust_enabled', '1', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 5. Seed Activity History (FR-06)
INSERT INTO public.activity_history (id, event_type, title, details, brightness_pct, timestamp)
VALUES
    (1, 'LIGHT', 'Day brightness activated', 'Automated circadian brightness set to 75%', 75, NOW() - INTERVAL '5 hours'),
    (2, 'LIGHT', 'Morning brightness activated', 'Automated circadian brightness set to 60%', 60, NOW() - INTERVAL '4 hours'),
    (3, 'USER', 'Night routine updated', 'Routine schedule adjusted to 25%', 25, NOW() - INTERVAL '3 hours'),
    (4, 'USER', 'Day routine updated', 'Routine schedule adjusted to 75%', 75, NOW() - INTERVAL '2 hours'),
    (5, 'LIGHT', 'Night brightness activated', 'Automated circadian brightness set to 25%', 25, NOW() - INTERVAL '1 hour'),
    (6, 'LIGHT', 'Morning brightness activated', 'Initial rhythm initialized', 60, NOW())
ON CONFLICT (id) DO NOTHING;

-- Synchronize identity sequences
SELECT setval('public.users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.users));
SELECT setval('public.schedules_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.schedules));
SELECT setval('public.routines_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.routines));
SELECT setval('public.activity_history_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.activity_history));
