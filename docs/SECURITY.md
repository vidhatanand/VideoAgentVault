# Security model

One installation owns one workspace. Workspace identity must be bound server-side, never trusted from request parameters. Owner authentication and agent authentication are separate. Agents need explicit folder grants and separate permissions for processing, publishing, downloading and deletion.

Media, captions and retrieved evidence are untrusted content. Instructions embedded in them do not authorize commands, cloud changes or credential access. Signed player grants must expire and respect revocation. Cloud credentials must never reach browser code.

Provider spend estimates are not an account-wide spending cap. Concurrent jobs require reserved budgets and idempotent accounting. Uncertain paid outcomes require reconciliation before another chargeable attempt.

Do not post tokens, private media, database snapshots or personal data in public issues. Use [GitHub private vulnerability reporting](https://github.com/vidhatanand/VideoAgentVault/security/advisories/new) for security issues. It is enabled for this repository. Include affected commit, reproduction steps using synthetic data, and expected versus observed behavior. Avoid public disclosure until maintainers can assess the report. This development preview has no promised response-time SLA.
