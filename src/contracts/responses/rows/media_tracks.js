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
    "language": {
      "type": "string"
    },
    "label": {
      "type": "string"
    },
    "is_default": {
      "type": "integer"
    },
    "path": {
      "type": [
        "string",
        "null"
      ]
    },
    "source_video_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "cues_json": {
      "type": [
        "string",
        "null"
      ]
    },
    "status": {
      "type": "string"
    },
    "created_at": {
      "type": "integer"
    },
    "updated_at": {
      "type": "integer"
    },
    "revision": {
      "type": "integer"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "video_id",
    "kind",
    "language",
    "label",
    "is_default",
    "path",
    "source_video_id",
    "cues_json",
    "status",
    "created_at",
    "updated_at",
    "revision"
  ],
  "additionalProperties": false
};
