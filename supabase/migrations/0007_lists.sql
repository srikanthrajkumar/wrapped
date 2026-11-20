-- A Manodharma part's Ragas and the Layavinyasam's nadais become lists, and thirteen Roles join
-- (docs/adr/0012). The server keeps each row as sent, so nothing here changes its tables: rows in
-- the old shape stay until the Item is next edited, and every phone from 0.4.0 upgrades them as it
-- pulls. A build before 0.4.0 would misread a row in the new shape (a Layavinyasam with no
-- `nadai`), and would refuse to save an Appearance with a new Role, so it gets 426 from now on
-- (contracts/sync-api.md, "Errors"; CONTRIBUTING.md).

update private.server_config set min_app_version = '0.4.0';
