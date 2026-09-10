// Generated from migrations by scripts/contracts/rows.mjs.
export default {
  "type": "object",
  "properties": {
    "job_id": {
      "type": "string"
    },
    "agent_id": {
      "type": "string"
    },
    "tenant_id": {
      "type": "string"
    },
    "run_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "amount_micros": {
      "type": "integer"
    },
    "charged_micros": {
      "type": [
        "integer",
        "null"
      ]
    },
    "day": {
      "type": "string"
    },
    "month": {
      "type": "string"
    },
    "created_at": {
      "type": "integer"
    },
    "settled_at": {
      "type": [
        "integer",
        "null"
      ]
    }
  },
  "required": [
    "job_id",
    "agent_id",
    "tenant_id",
    "run_id",
    "amount_micros",
    "charged_micros",
    "day",
    "month",
    "created_at",
    "settled_at"
  ],
  "additionalProperties": false
};
