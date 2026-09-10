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
    "job_id": {
      "type": "string"
    },
    "path": {
      "type": "string"
    },
    "format": {
      "type": "string"
    },
    "created_at": {
      "type": "integer"
    },
    "revoked_at": {
      "type": [
        "integer",
        "null"
      ]
    }
  },
  "required": [
    "id",
    "tenant_id",
    "video_id",
    "job_id",
    "path",
    "format",
    "created_at",
    "revoked_at"
  ],
  "additionalProperties": false
};
