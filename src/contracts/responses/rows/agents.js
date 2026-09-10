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
    "purpose": {
      "type": "string"
    },
    "status": {
      "type": "string"
    },
    "legacy": {
      "type": "integer"
    },
    "permissions_json": {
      "type": "string"
    },
    "revision": {
      "type": "integer"
    },
    "created_by": {
      "type": "string"
    },
    "created_at": {
      "type": "integer"
    },
    "last_active_at": {
      "type": [
        "integer",
        "null"
      ]
    },
    "operation_micros": {
      "type": "integer"
    },
    "run_micros": {
      "type": "integer"
    },
    "daily_micros": {
      "type": "integer"
    },
    "monthly_micros": {
      "type": "integer"
    },
    "concurrent_jobs": {
      "type": "integer"
    },
    "retained_bytes": {
      "type": "integer"
    },
    "upload_bytes_daily": {
      "type": "integer"
    }
  },
  "required": [
    "id",
    "tenant_id",
    "name",
    "purpose",
    "status",
    "legacy",
    "permissions_json",
    "revision",
    "created_by",
    "created_at",
    "last_active_at",
    "operation_micros",
    "run_micros",
    "daily_micros",
    "monthly_micros",
    "concurrent_jobs",
    "retained_bytes",
    "upload_bytes_daily"
  ],
  "additionalProperties": false
};
