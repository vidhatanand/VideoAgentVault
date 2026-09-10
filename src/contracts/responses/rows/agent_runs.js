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
    "external_id": {
      "type": "string"
    },
    "objective": {
      "type": "string"
    },
    "output_folder_id": {
      "type": "string"
    },
    "inputs_json": {
      "type": "string"
    },
    "ceiling_micros": {
      "type": "integer"
    },
    "state": {
      "type": "string"
    },
    "revision": {
      "type": "integer"
    },
    "created_at": {
      "type": "integer"
    },
    "updated_at": {
      "type": "integer"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "agent_id",
    "external_id",
    "objective",
    "output_folder_id",
    "inputs_json",
    "ceiling_micros",
    "state",
    "revision",
    "created_at",
    "updated_at"
  ],
  "additionalProperties": false
};
