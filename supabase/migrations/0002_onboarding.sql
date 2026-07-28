-- Workspace bootstrap.
--
-- A new user needs a workspace before they can record anything. Doing this in
-- the database (rather than the dashboard) means the extension works even if
-- the user's first action is to hit record.

create or replace function create_workspace_with_owner(ws_name text, ws_industry workspace_industry default 'tech')
returns workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  new_ws workspaces;
  base_slug text;
  final_slug text;
  n integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Slugify: lowercase, non-alphanumerics to hyphens, trim edge hyphens.
  base_slug := trim(both '-' from regexp_replace(lower(ws_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'workspace';
  end if;

  -- Append a counter until the slug is free.
  final_slug := base_slug;
  while exists (select 1 from workspaces where slug = final_slug) loop
    n := n + 1;
    final_slug := base_slug || '-' || n;
  end loop;

  insert into workspaces (name, slug, industry, created_by)
  values (ws_name, final_slug, ws_industry, auth.uid())
  returning * into new_ws;

  insert into workspace_members (workspace_id, user_id, role)
  values (new_ws.id, auth.uid(), 'owner');

  return new_ws;
end;
$$;

grant execute on function create_workspace_with_owner(text, workspace_industry) to authenticated;

-- Records a transcript edit: updates the segment, writes the audit row, and
-- promotes the change into workspace vocabulary when the edit looks like a
-- single-term correction. Runs as one transaction so the vocabulary can never
-- drift from the transcript.
create or replace function apply_transcript_correction(
  p_segment_id uuid,
  p_new_text text,
  p_learn_vocabulary boolean default true
)
returns transcript_segments
language plpgsql
security definer
set search_path = public
as $$
declare
  seg transcript_segments;
  old_words text[];
  new_words text[];
  i integer;
  diff_count integer := 0;
  diff_index integer;
begin
  select * into seg from transcript_segments where id = p_segment_id;
  if not found then
    raise exception 'segment not found';
  end if;
  if not is_workspace_member(seg.workspace_id) then
    raise exception 'forbidden';
  end if;
  if seg.text = p_new_text then
    return seg;
  end if;

  insert into transcript_corrections (workspace_id, meeting_id, segment_id, before_text, after_text, created_by)
  values (seg.workspace_id, seg.meeting_id, seg.id, seg.text, p_new_text, auth.uid());

  -- Learn a vocabulary term only from a clean one-word substitution. Anything
  -- more complex (rewording, punctuation, multi-word edits) is recorded in
  -- transcript_corrections for Month 5 auto-suggest but not auto-applied,
  -- because a bad global rule corrupts every future meeting.
  if p_learn_vocabulary then
    old_words := regexp_split_to_array(seg.text, '\s+');
    new_words := regexp_split_to_array(p_new_text, '\s+');

    if array_length(old_words, 1) = array_length(new_words, 1) then
      for i in 1 .. array_length(old_words, 1) loop
        if old_words[i] <> new_words[i] then
          diff_count := diff_count + 1;
          diff_index := i;
        end if;
      end loop;

      if diff_count = 1
         and length(old_words[diff_index]) >= 3
         and length(new_words[diff_index]) >= 2 then
        insert into vocabulary_terms (workspace_id, wrong, right_term, source, created_by)
        values (
          seg.workspace_id,
          -- Strip surrounding punctuation so "figma," doesn't become a term.
          trim(both '.,!?;:"''' from old_words[diff_index]),
          trim(both '.,!?;:"''' from new_words[diff_index]),
          'correction',
          auth.uid()
        )
        on conflict (workspace_id, lower(wrong))
        do update set right_term = excluded.right_term, updated_at = now();
      end if;
    end if;
  end if;

  update transcript_segments
     set text = p_new_text, edited_at = now(), edited_by = auth.uid()
   where id = p_segment_id
  returning * into seg;

  return seg;
end;
$$;

grant execute on function apply_transcript_correction(uuid, text, boolean) to authenticated;
