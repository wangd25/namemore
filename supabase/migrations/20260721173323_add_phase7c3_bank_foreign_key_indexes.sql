create index category_answer_bank_aliases_answer_idx
  on private.category_answer_bank_aliases (bank_version_id, answer_id);

create index category_answer_bank_versions_editor_idx
  on private.category_answer_bank_versions (editor_user_id);
