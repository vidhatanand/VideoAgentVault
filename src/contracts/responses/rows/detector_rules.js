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
    "name": {
      "type": "string"
    },
    "query": {
      "type": "string"
    },
    "match_mode": {
      "type": "string"
    },
    "threshold": {
      "type": "number"
    },
    "enabled": {
      "type": "integer"
    },
    "created_at": {
      "type": "integer"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "name",
    "query",
    "match_mode",
    "threshold",
    "enabled",
    "created_at"
  ],
  "additionalProperties": false
};
