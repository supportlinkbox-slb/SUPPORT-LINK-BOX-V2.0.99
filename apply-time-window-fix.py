#!/usr/bin/env python3
# Applies the submission time-window fix to supabase/production-hardening.sql
# Run from repo root: python3 apply-time-window-fix.py
import sys

path = 'supabase/production-hardening.sql'
with open(path, 'r') as f:
    content = f.read()

# Find the function
start = content.find('CREATE OR REPLACE FUNCTION public.rpc_submit_daily_link(')
if start == -1:
    print("ERROR: function not found")
    sys.exit(1)
next_func = content.find('CREATE OR REPLACE FUNCTION', start + 10)
func_text = content[start:next_func]

# Skip if already patched
if 'SUBMISSION_CLOSED' in func_text:
    print("Already patched, skipping.")
    sys.exit(0)

# 1. Add DECLARE variables
old_declare = "    v_existing_count INTEGER;\nBEGIN"
new_declare = """    v_existing_count INTEGER;
    v_start_str VARCHAR(10);
    v_end_str VARCHAR(10);
    v_now_bdt TIME;
BEGIN"""
assert old_declare in func_text, "DECLARE not found"
func_text = func_text.replace(old_declare, new_declare, 1)

# 2. Insert time window check
old_check = "    -- Normal members: 1 link per day limit"
new_check = """    -- Server-side submission time window enforcement for members (default 10:00-16:50 BDT)
    IF v_member.role = 'MEMBER' THEN
        BEGIN
            SELECT submission_start_time, submission_end_time
            INTO v_start_str, v_end_str
            FROM public.settings
            WHERE community_id = v_member.community_id OR community_id = 'main'
            ORDER BY (community_id = 'main') DESC
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            v_start_str := NULL;
            v_end_str := NULL;
        END;

        IF v_start_str IS NULL OR v_start_str = '' THEN v_start_str := '10:00'; END IF;
        IF v_end_str IS NULL OR v_end_str = '' THEN v_end_str := '16:50'; END IF;

        v_now_bdt := (NOW() AT TIME ZONE 'Asia/Dhaka')::time;

        IF v_now_bdt < v_start_str::time OR v_now_bdt > v_end_str::time THEN
            RAISE EXCEPTION 'SUBMISSION_CLOSED: Link submission is open from % to % (Asia/Dhaka).', v_start_str, v_end_str;
        END IF;
    END IF;

    -- Normal members: 1 link per day limit"""
assert old_check in func_text, "Insert point not found"
func_text = func_text.replace(old_check, new_check, 1)

# Write back
content = content[:start] + func_text + content[next_func:]
with open(path, 'w') as f:
    f.write(content)

print("Patched OK: submission time window enforced for members.")
