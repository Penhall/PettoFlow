-- Public wrappers for pgcrypto functions used by application code.
-- pgcrypto is installed in the 'extensions' schema, but the app calls
-- gen_random_bytes() without schema qualification.
-- These wrappers in 'public' fix the search_path resolution issue.

create or replace function public.gen_random_bytes(integer)
returns bytea
language sql
as $$
  select extensions.gen_random_bytes($1);
$$;
