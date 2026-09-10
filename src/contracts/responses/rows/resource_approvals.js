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
    "resource_type": {
      "type": "string"
    },
    "resource_id": {
      "type": "string"
    },
    "snapshot_json": {
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
    }
  },
  "required": [
    "id",
    "tenant_id",
    "agent_id",
    "resource_type",
    "resource_id",
    "snapshot_json",
    "state",
    "expires_at",
    "created_at",
    "decided_by",
    "decided_at",
    "consumed_at"
  ],
  "additionalProperties": false
};
