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
    "video_id": {
      "type": "string"
    },
    "action": {
      "type": "string"
    },
    "revision": {
      "type": "integer"
    },
    "payload_json": {
      "type": "string"
    },
    "payload_hash": {
      "type": "string"
    },
    "state": {
      "type": "string"
    },
    "expires_at": {
      "type": "integer"
    },
    "created_at": {
      "type": "integer"
    },
    "decided_by": {
      "type": [
        "string",
        "null"
      ]
    },
    "decided_at": {
      "type": [
        "integer",
        "null"
      ]
    },
    "consumed_at": {
      "type": [
        "integer",
        "null"
      ]
    },
    "inputs_json": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "agent_id",
    "video_id",
    "action",
    "revision",
    "payload_json",
    "payload_hash",
    "state",
    "expires_at",
    "created_at",
    "decided_by",
    "decided_at",
    "consumed_at",
    "inputs_json"
  ],
  "additionalProperties": false
};
