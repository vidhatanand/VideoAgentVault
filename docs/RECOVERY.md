# Database recovery

Database recovery has passed a synthetic isolated Cloudflare D1 round trip. Complete installation disaster recovery remains open: the database does not contain the original video bytes, all derived objects, Vectorize contents or persistent encryption secrets.

## Capture a private logical backup

Pause new work and allow processing to settle. Keep the installation's source revision and configuration with your recovery records. Provide `CLOUDFLARE_API_TOKEN` securely through the environment, then run:

```sh
node scripts/recovery/capture.mjs --account YOUR_ACCOUNT_ID --database YOUR_DATABASE_ID --output /private/backup/new-directory
node scripts/recovery/restore.mjs --input /private/backup/new-directory --output /private/backup/restored.sqlite
```

Use a new private directory and a new SQLite destination. Existing destinations are refused. Backup files may contain sensitive application data and authentication records; never commit them or publish them as release assets. The bundle contains a SHA-256 manifest, a logical snapshot and an independently restored SQLite file. Do not accept backup bundles from untrusted sources; their SQL schema is executable.

Capture refuses active jobs, prepares the application schema, and reads application rows and a schema receipt in one SQL statement. It rejects concurrent schema changes. Restore preserves row values, indexes, triggers, views and AUTOINCREMENT high-water marks, rebuilds FTS5, and checks foreign keys and SQLite integrity. Provider-internal tables and FTS shadow tables are excluded.

## Restore into an isolated D1 database

Create a new empty D1 database under the same approved account. The `restoreSql(snapshot)` function in `scripts/recovery/restore-sql.mjs` converts a checksum-verified bundle into fresh-database SQL. It never emits DROP statements. Do not point it at an existing installation. Import through the D1 query API or Wrangler, then capture the restored database with the command above. Compare application schema and every table hash with the source bundle; query both agent permission views and verify a known full-text search result. Keep the original database until all checks pass.

Cloudflare D1 rejects `PRAGMA integrity_check` with `SQLITE_AUTH`. Run that check on the locally restored snapshot. Hosted verification separately checks `PRAGMA foreign_key_check`, complete row hashes, application schema, permission-view queries and FTS search. Do not describe the local SQLite check as a remote physical-integrity check.

## Evidence and remaining work

On 2026-09-10, the isolated hosted restore reproduced all 66 application tables, the complete application schema and both agent permission views; a known synthetic transcript search succeeded. The corrected round trip recorded 3,656 rows read and 316 written, excluding earlier setup and diagnostics. The public capture and local restore commands also passed against that synthetic source. Local regression tests cover missing snapshot data, tampering, occupied destinations, FTS, provider internals, large schema enumeration, permission views and sequence preservation.

A complete installation drill still needs protected R2 object recovery, encrypted media readability using separately protected secrets, Vectorize restoration or explicitly authorized reindexing, deployed owner/agent access and an upgrade/rollback test. No substitute recovery provider is selected.
