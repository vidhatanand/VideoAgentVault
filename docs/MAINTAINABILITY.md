# Maintainability review — 2026-09-10

Reviewed the standalone runtime, browser modules, CLI, installation/recovery tooling and their tests. A local import-graph pass found no orphaned JavaScript or TypeScript modules reachable from the application, tooling and test entry points. This does not prove that every exported function or runtime branch is used.

## Completed cleanup

- Removed 37 unused application import bindings and one unused test import. Removed obsolete live-service options from the stored-video Content Security Policy helper.
- Added a conservative AST-based unused-import regression check for application and tooling modules. CLI typechecking now rejects unused locals and parameters.
- Separated paid-action argument construction, job-progress presentation and application entry routing into small browser modules.
- Organized CLI build/package checks, installation validation, recovery snapshots/bundles/restores, independent-client acceptance and quality checks into separate folders.
- Formatted the new CLI, installer and recovery modules with Prettier 3.6.2. No broad formatting-only rewrite of existing video-processing code was performed.
- Added tests for processing request schemas, shared-viewer versus owner routing, HLS worker policy, installation ownership/limits, ambiguous CLI mutations and database recovery.

## Follow-up boundaries

The import check deliberately detects only definite unused bindings; it is not a whole-program proof or an exported-API deletion tool. Keep contract operations until a versioned deprecation process authorizes removal. The current API catalogue remains 78 operations.

Future extraction should prioritize the dense library/agent browser forms and job orchestration code when changing those areas, with behavioral tests around each extraction. Installer interrupted-write reconciliation, full object/secret recovery, schema portability warnings and hosted UI execution remain separate release gates. See [release status](RELEASE_STATUS.md).
