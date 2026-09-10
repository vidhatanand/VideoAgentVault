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
      "type": [
        "string",
        "null"
      ]
    },
    "layer": {
      "type": "string"
    },
    "start_seconds": {
      "type": "number"
    },
    "end_seconds": {
      "type": "number"
    },
    "text": {
      "type": "string"
    },
    "data_json": {
      "type": "string"
    },
    "vector_id": {
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
    "job_id",
    "layer",
    "start_seconds",
    "end_seconds",
    "text",
    "data_json",
    "vector_id",
    "created_at"
  ],
  "additionalProperties": false
};
