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
    "access": {
      "type": "string"
    },
    "inherit": {
      "type": "integer"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "agent_id",
    "resource_type",
    "resource_id",
    "access",
    "inherit"
  ],
  "additionalProperties": false
};
