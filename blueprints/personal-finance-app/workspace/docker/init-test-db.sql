-- Runs only the first time the pfa-pgdata volume is initialised.
-- Bootstrap also creates this database defensively, so a pre-existing volume
-- (one created before this file was added) still ends up with both databases.
CREATE DATABASE personal_finance_test;
