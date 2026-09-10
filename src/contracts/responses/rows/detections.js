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
    "rule_id": {
      "type": "string"
    },
    "artifact_id": {
      "type": "string"
    },
    "video_id": {
      "type": "string"
    },
    "score": {
      "type": "number"
    },
    "created_at": {
      "type": "integer"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "rule_id",
    "artifact_id",
    "video_id",
    "score",
    "created_at"
  ],
  "additionalProperties": false
};
