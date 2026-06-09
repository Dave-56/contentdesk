-- Neon leaves the connecting role's default search_path empty, so unqualified
-- table names fail with 42P01 (relation does not exist). Set it to public so
-- direct (non-pooled) connections resolve tables without schema qualification.
do $$
begin
  execute format('alter role %I set search_path to public', current_user);
end $$;
