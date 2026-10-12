# Lysto project instructions

## Supabase production access

- The hosted Supabase project for this repository is `dqonlqcurvjnjgsczevu`.
- The configured Codex MCP server is `lysto-supabase`. It is authorized with OAuth and write-enabled feature groups for database, debugging, development, Edge Functions, branching, and Storage.
- Supabase CLI access is also persisted locally under the Owner account. On Windows, use `node_modules\.bin\supabase.cmd`; discover every command with `--help` before running it.
- The Supabase dashboard is available through the Codex in-app browser when an interactive dashboard operation is needed.

For any Supabase task, do not report that production access is unavailable until all of the following have been checked:

1. Look for the `lysto-supabase` MCP tools in the current session.
2. If they are not loaded, run `codex mcp list` and verify that `lysto-supabase` is enabled with `OAuth` authentication. A newly configured MCP server may require reloading Codex before its tools appear.
3. Use the linked local CLI as the immediate fallback and verify that `supabase/.temp/project-ref` matches `dqonlqcurvjnjgsczevu` before executing a remote command.
4. If authentication has actually expired, start the appropriate OAuth/login flow. Do not ask the user to paste credentials into chat.

Credentials and API secrets are stored outside the repository. Never print them, copy them into tracked files, add them to `NEXT_PUBLIC_*` variables, or commit them. Do not duplicate the stored secret key in `.env` files merely to make an agent task easier.

For database work:

- Use MCP `execute_sql` or `supabase db query --linked` for inspection and controlled iteration.
- Create durable schema changes through a migration created with `supabase migration new <name>`; keep the migration in `supabase/migrations/` and verify it against the linked project.
- Enable and verify RLS for tables in exposed schemas, especially `public`, and create policies that match the intended access model.
- Run Supabase security and performance advisors after changes that affect schema, policies, views, functions, triggers, Auth, or Storage.
- Verify the completed change with a focused query or test. Do not claim success from configuration alone.
- Treat `DROP`, `TRUNCATE`, destructive `DELETE`/`UPDATE`, credential rotation, and production data rewrites as destructive operations: require an explicit user request, resolve the exact target first, and use a recoverable or transactional approach when possible.

The configured access is sufficient to create, inspect, alter, and remove application tables; read and write rows; manage policies, functions, triggers, migrations, Auth, Storage, and Edge Functions; and inspect logs. It does not grant operating-system or infrastructure-root access to Supabase's managed platform.
