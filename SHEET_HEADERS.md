# Google Sheets header rows (Row 1 of each tab)

The Edge Function writes values POSITIONALLY — the first value is always the
batch id, then the columns in the exact order below. Your Row 1 headers MUST
match this order, otherwise values land under the wrong headers.

Copy each line as the tab-separated Row 1 of the matching tab.

## Tab: Daily Links Archive
export_batch_id	id	community_id	owner_id	member_id	date	serial_number	link_number	serial_display	part_number	post_type	category	caption	instruction	fb_link	submitted_at	is_approved	total_supports_count	status	owner_name	owner_member_number	created_at	updated_at

## Tab: Support Records Archive
export_batch_id	id	community_id	link_id	supporter_id	receiver_id	date	supported_at	points_awarded	created_at

## Tab: All Done Archive
export_batch_id	id	community_id	member_id	date	completed_at	total_supports_given	required_supports_count	points_awarded	fastest_bonus_points	total_points	fastest_rank	status	member_name	member_number	created_at	updated_at

## Tab: Points Archive
export_batch_id	id	member_id	activity_type	points	date	reference_id	description	created_at

---
Policy reminder:
- BACKUP ONLY (never deleted): Daily Links, All Done, Points
- BACKUP + DELETE after VERIFIED: Support Records only
