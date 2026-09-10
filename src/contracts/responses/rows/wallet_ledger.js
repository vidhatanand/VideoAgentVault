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
    "delta_micros": {
      "type": "integer"
    },
    "kind": {
      "type": "string"
    },
    "reference": {
      "type": "string"
    },
    "created_at": {
      "type": "integer"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "delta_micros",
    "kind",
    "reference",
    "created_at"
  ],
  "additionalProperties": false
};
