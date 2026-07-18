create or replace function private.normalize_daily_display_name(p_display_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized_name text;
begin
  if p_display_name is null or p_display_name ~ '[[:cntrl:]]' then
    return null;
  end if;

  normalized_name := regexp_replace(btrim(p_display_name), '[[:space:]]+', ' ', 'g');

  if char_length(normalized_name) not between 2 and 24
    or normalized_name !~ '^[[:alnum:]][[:alnum:] .''’-]*$'
  then
    return null;
  end if;

  return normalized_name;
end;
$$;

revoke all on function private.normalize_daily_display_name(text) from public, anon, authenticated;
