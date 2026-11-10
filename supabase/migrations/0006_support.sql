-- An Appearance's `support` (2026-11-10; data-model.md, contracts/schedule-feed.md "Billed"): true
-- when the Schedule billed someone as support. The server keeps the row as sent, so nothing here
-- changes its tables. A build before 0.2.0 would drop the field on its next save of that row and
-- push it back without it, naming the Concert by its support violinist on every phone, so it gets
-- 426 from now on (contracts/sync-api.md, "Errors"; CONTRIBUTING.md).

update private.server_config set min_app_version = '0.2.0';
