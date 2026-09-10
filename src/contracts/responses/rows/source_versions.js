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
    "object_id": {
      "type": "string"
    },
    "fingerprint": {
      "type": [
        "string",
        "null"
      ]
    },
    "fingerprint_method": {
      "type": "string"
    },
    "source_revision": {
      "type": "integer"
    },
    "path": {
      "type": "string"
    },
    "size": {
      "type": "integer"
    },
    "duration_seconds": {
      "type": "number"
    },
    "created_at": {
      "type": "integer"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "video_id",
    "object_id",
    "fingerprint",
    "fingerprint_method",
    "source_revision",
    "path",
    "size",
    "duration_seconds",
    "created_at"
  ],
  "additionalProperties": false
};
