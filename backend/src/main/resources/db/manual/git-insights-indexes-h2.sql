-- WS-GH-02: indexes for the GitHub tab activity insights (H2).
-- Dev uses ddl-auto=update (Hibernate creates them from the entity @Index); run this by hand only where
-- the schema is managed manually. No table or column is added: insights are computed when read.

CREATE INDEX IF NOT EXISTS idx_git_commit_repo_ref ON git_commits (repository_id, first_seen_ref, committed_at);
CREATE INDEX IF NOT EXISTS idx_git_pr_repo_created ON git_pull_requests (repository_id, github_created_at);
CREATE INDEX IF NOT EXISTS idx_git_pr_repo_merged ON git_pull_requests (repository_id, merged_at);
CREATE INDEX IF NOT EXISTS idx_git_review_repo_time ON git_pull_request_reviews (repository_id, submitted_at);
