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
    "spec_json": {
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
    },
    "agent_id": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "id",
    "tenant_id",
    "name",
    "spec_json",
    "created_at",
    "updated_at",
    "revision",
    "agent_id"
  ],
  "additionalProperties": false
};
