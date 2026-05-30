-- Reset ALL Red Alerts data while KEEPING the schema (tables, indexes) intact.
-- Run this to wipe events and start clean - no re-sync needed afterwards.
--
-- Usage (through your SSH tunnel, e.g. localhost:3307):
--   mysql -h 127.0.0.1 -P 3307 -u <user> -p <database> < resources/sql/reset_database.sql
-- or paste it into any MySQL client connected to the target database.
--
-- This TRUNCATEs every data table only; table/index definitions are untouched.
--
-- IMPORTANT: pick the schema first, or you'll get "Error 1046: No database
-- selected". Either double-click the schema in the Workbench SCHEMAS sidebar, OR
-- set the name below and uncomment it (keep the backticks - the name has a dash):
-- USE `RedAlerts-PROD`;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE event_oref_ids;
TRUNCATE TABLE event_cities;
TRUNCATE TABLE events;
TRUNCATE TABLE cities;
TRUNCATE TABLE categories;
TRUNCATE TABLE titles;
TRUNCATE TABLE descriptions;

SET FOREIGN_KEY_CHECKS = 1;
