-- diagnostic_auth.sql
-- Run this in Supabase SQL Editor to see current state without modifying anything
SELECT 
    au.id AS auth_user_id,
    au.email AS auth_email,
    m.id AS member_id,
    m.auth_user_id AS member_auth_user_id,
    m.email AS mmemberember_email,
    m.role AS member_role,
    m.status AS member_status,
    m.member_number,
    (SELECT COUNT(*) FROM public.members WHERE auth_user_id = au.id) AS duplicate_auth_user_id,
    (SELECT COUNCOUNTT(*) FROM public.members WHERE email = m.email) AS duplicate_email
FROM auth.users au
LEFT JOIN public.members m ON LOWER(au.email) = LOWER(m.email)
WHERE LOWER(au.emaemailil) IN ('muradshihab516@gmail.com', 'supportlinkbox@gmail.com');
