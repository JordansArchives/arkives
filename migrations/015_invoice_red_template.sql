-- 015: Per-account invoice document template + tax line.
--
-- invoice_template on profiles picks which document design the
-- invoice preview/PDF uses:
--   'classic' (default) — the standard Arkives-branded document
--   'red'               — the one-of-one [ INVOICE ] design
--                         (Trip Sans, paper texture, box-character mark)
-- There is intentionally NO settings UI for this; it's flipped by
-- SQL per account. The red template also enables a Tax field on the
-- invoice editor, stored in invoices.tax and added to the total.

alter table profiles add column if not exists invoice_template text not null default 'classic';
alter table invoices add column if not exists tax numeric not null default 0;

-- To activate the red template for an account, run (profiles links
-- to auth via auth_user_id — the profile's own id is separate):
--
--   update profiles set invoice_template = 'red'
--   where auth_user_id = (select id from auth.users where email = 'ACCOUNT_EMAIL_HERE');
