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
    "parent_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "created_at": {
      "type": "integer"
    },
    "shared": {
      "type": "integer"
    },
    "revision": {
      "type": "integer"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "parent_id",
    "name",
    "created_at",
    "shared",
    "revision"
  ],
  "additionalProperties": false
};
