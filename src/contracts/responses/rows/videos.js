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
    "folder_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "tags_json": {
      "type": "string"
    },
    "kind": {
      "type": "string"
    },
    "status": {
      "type": "string"
    },
    "visibility": {
      "type": "string"
    },
    "allowed_origins_json": {
      "type": "string"
    },
    "watermark_text": {
      "type": "string"
    },
    "max_sessions": {
      "type": "integer"
    },
    "primary_path": {
      "type": "string"
    },
    "source_path": {
      "type": "string"
    },
    "thumbnail_path": {
      "type": [
        "string",
        "null"
      ]
    },
    "caption_path": {
      "type": [
        "string",
        "null"
      ]
    },
    "summary": {
      "type": "string"
    },
    "index_status": {
      "type": "string"
    },
    "expected_bytes": {
      "type": "integer"
    },
    "duration_seconds": {
      "type": "number"
    },
    "width": {
      "type": "integer"
    },
    "height": {
      "type": "integer"
    },
    "token_version": {
      "type": "integer"
    },
    "encrypted": {
      "type": "integer"
    },
    "upload_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "upload_key": {
      "type": [
        "string",
        "null"
      ]
    },
    "created_at": {
      "type": "integer"
    },
    "updated_at": {
      "type": "integer"
    },
    "uploaded_at": {
      "type": [
        "integer",
        "null"
      ]
    },
    "deleted_at": {
      "type": [
        "integer",
        "null"
      ]
    },
    "last_error": {
      "type": [
        "string",
        "null"
      ]
    },
    "probe_json": {
      "type": [
        "string",
        "null"
      ]
    },
    "preview_path": {
      "type": [
        "string",
        "null"
      ]
    },
    "sprite_path": {
      "type": [
        "string",
        "null"
      ]
    },
    "downloads_enabled": {
      "type": "integer"
    },
    "preview_meta_json": {
      "type": [
        "string",
        "null"
      ]
    },
    "revision": {
      "type": "integer"
    },
    "agent_id": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "id",
    "tenant_id",
    "folder_id",
    "title",
    "description",
    "tags_json",
    "kind",
    "status",
    "visibility",
    "allowed_origins_json",
    "watermark_text",
    "max_sessions",
    "primary_path",
    "source_path",
    "thumbnail_path",
    "caption_path",
    "summary",
    "index_status",
    "expected_bytes",
    "duration_seconds",
    "width",
    "height",
    "token_version",
    "encrypted",
    "upload_id",
    "upload_key",
    "created_at",
    "updated_at",
    "uploaded_at",
    "deleted_at",
    "last_error",
    "probe_json",
    "preview_path",
    "sprite_path",
    "downloads_enabled",
    "preview_meta_json",
    "revision",
    "agent_id"
  ],
  "additionalProperties": false
};
