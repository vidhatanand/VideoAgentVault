// Generated from migrations by scripts/contracts/rows.mjs.
export default {
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "tenant_id": {
      "type": "string"
    },
    "video_id": {
      "type": "string"
    },
    "source_version_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "artifact_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "job_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "origin": {
      "type": "string"
    },
    "kind": {
      "type": "string"
    },
    "start_seconds": {
      "type": "number"
    },
    "end_seconds": {
      "type": "number"
    },
    "language": {
      "type": "string"
    },
    "method_json": {
      "type": "string"
    },
    "coverage_json": {
      "type": "string"
    },
    "payload_json": {
      "type": "string"
    },
    "payload_sha256": {
      "type": [
        "string",
        "null"
      ]
    },
    "created_at": {
      "type": "integer"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "video_id",
    "source_version_id",
    "artifact_id",
    "job_id",
    "origin",
    "kind",
    "start_seconds",
    "end_seconds",
    "language",
    "method_json",
    "coverage_json",
    "payload_json",
    "payload_sha256",
    "created_at"
  ],
  "additionalProperties": false
};
