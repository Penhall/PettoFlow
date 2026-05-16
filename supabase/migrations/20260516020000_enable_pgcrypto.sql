-- Enable pgcrypto extension for gen_random_bytes() and gen_random_uuid()
-- Required by Supabase auth and invitation flows
create extension if not exists "pgcrypto" with schema public;
