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
    "version": {
      "type": "integer"
    },
    "created_by": {
      "type": "string"
    },
    "agent_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "inputs_json": {
      "type": "string"
    },
    "variants_json": {
      "type": "string"
    },
    "payload_hash": {
      "type": "string"
    },
    "request_key": {
      "type": "string"
    },
    "created_at": {
      "type": "integer"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "name",
    "version",
    "created_by",
    "agent_id",
    "inputs_json",
    "variants_json",
    "payload_hash",
    "request_key",
    "created_at"
  ],
  "additionalProperties": false
};
