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
    "kind": {
      "type": "string"
    },
    "state": {
      "type": "string"
    },
    "attempts": {
      "type": "integer"
    },
    "next_run_at": {
      "type": "integer"
    },
    "lease_until": {
      "type": "integer"
    },
    "created_at": {
      "type": "integer"
    },
    "updated_at": {
      "type": "integer"
    },
    "finished_at": {
      "type": [
        "integer",
        "null"
      ]
    },
    "stream_uid": {
      "type": [
        "string",
        "null"
      ]
    },
    "stream_created_at": {
      "type": [
        "integer",
        "null"
      ]
    },
    "stream_deleted_at": {
      "type": [
        "integer",
        "null"
      ]
    },
    "provider_duration_seconds": {
      "type": "number"
    },
    "export_attempts": {
      "type": "integer"
    },
    "hold_micros": {
      "type": "integer"
    },
    "max_wall_seconds": {
      "type": "integer"
    },
    "keep_source": {
      "type": "integer"
    },
    "last_error": {
      "type": [
        "string",
        "null"
      ]
    },
    "payload_json": {
      "type": "string"
    },
    "result_json": {
      "type": [
        "string",
        "null"
      ]
    },
    "request_key": {
      "type": "string"
    },
    "request_hash": {
      "type": [
        "string",
        "null"
      ]
    },
    "agent_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "key_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "run_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "progress_json": {
      "type": [
        "string",
        "null"
      ]
    },
    "reuse_fingerprint": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "id",
    "tenant_id",
    "video_id",
    "kind",
    "state",
    "attempts",
    "next_run_at",
    "lease_until",
    "created_at",
    "updated_at",
    "finished_at",
    "stream_uid",
    "stream_created_at",
    "stream_deleted_at",
    "provider_duration_seconds",
    "export_attempts",
    "hold_micros",
    "max_wall_seconds",
    "keep_source",
    "last_error",
    "payload_json",
    "result_json",
    "request_key",
    "request_hash",
    "agent_id",
    "key_id",
    "run_id",
    "progress_json",
    "reuse_fingerprint"
  ],
  "additionalProperties": false
};
