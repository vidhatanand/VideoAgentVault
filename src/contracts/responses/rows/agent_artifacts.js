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
    "agent_id": {
      "type": "string"
    },
    "key_id": {
      "type": "string"
    },
    "run_id": {
      "type": "string"
    },
    "kind": {
      "type": "string"
    },
    "request_key": {
      "type": "string"
    },
    "payload_hash": {
      "type": "string"
    },
    "data_json": {
      "type": "string"
    },
    "inputs_json": {
      "type": "string"
    },
    "created_at": {
      "type": "integer"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "agent_id",
    "key_id",
    "run_id",
    "kind",
    "request_key",
    "payload_hash",
    "data_json",
    "inputs_json",
    "created_at"
  ],
  "additionalProperties": false
};
