# Backup API Reference

This document provides a technical reference for the CogniFlow Backup API, a secure REST API for managing backup files and API keys.

**Version:** 1.0.0
**Base URL:** `https://www.greenyogafestival.org/backup-api/api/v1`

---

## Authentication

All API endpoints require authentication via an API key provided in the `X-API-Key` header.

```http
X-API-Key: your-api-key-here
```

There are two types of keys:
-   **Admin API Key (`AdminApiKeyAuth`):** Required for managing API keys (`/keys` endpoints).
-   **Standard API Key (`ApiKeyAuth`):** Used for managing backups for a specific application (`/apps` endpoints).

### Authentication Failure Example

If an invalid or missing API key is provided, the API will respond with a `401 Unauthorized` error.
```json
{
   "error": "Unauthorized - Invalid API key"
}
```

---

## Common Error Responses

-   **400 Bad Request:** The request was malformed or missing required parameters.
-   **403 Forbidden:** The API key is valid but does not have permission to access the resource (e.g., trying to access another user's backup).
-   **404 Not Found:** The requested resource (e.g., a specific backup file) could not be found.
-   **409 Conflict:** The resource could not be created because it already exists (e.g., uploading a file with a name that is already in use).
-   **412 Precondition Failed:** An `If-Match` ETag was provided, but it does not match the current ETag of the resource on the server.
-   **500 Internal Server Error:** An unexpected error occurred on the server.

---

## Admin API Endpoints

These endpoints are for administrative purposes and require an **Admin API Key**.

### 1. Generate a new API key

**POST** `/keys/generate`

Creates a new standard API key.

**Request Body (`application/x-www-form-urlencoded`, optional):**
-   `description` (string): A description for the new key.

**Response (200 OK):**
```json
{
  "api_key": "newly-generated-api-key-string",
  "description": "Test Key"
}
```

### 2. List all API keys

**GET** `/keys`

Retrieves a list of all existing API keys.

**Response (200 OK):**
```json
{
  "keys": [
    {
      "id": 1,
      "key_value": "api-key-string",
      "description": "Test Key",
      "created_at": "2025-09-03T12:00:00Z",
      "is_active": true
    }
  ]
}
```

### 3. Revoke an API key

**DELETE** `/keys/{key_id}`

Revokes (deactivates) an API key by its ID.

**Path Parameters:**
-   `key_id` (integer, required): The ID of the key to revoke.

**Response (200 OK):**
```json
{
  "message": "API key revoked",
  "id": 1
}
```

---

## Backup API Endpoints

These endpoints are for managing backups for a specific `app_id` and require a **Standard API Key**. The `{app_id}` in the path should be replaced with your application's unique identifier (e.g., `cogniflow-data`).

### 1. Upload a backup file

**POST** `/apps/{app_id}/backups`

Uploads a new JSON backup file.

**Request Body (`multipart/form-data`):**
-   `file` (binary, required): The JSON backup file content.
-   `filename` (string, optional): A custom filename for the backup. If not provided, a name will be generated.

**Response (201 Created):**
```json
{
  "message": "Backup successful",
  "filename": "backup-2025-09-01T10:00:00Z.json"
}
```

### 2. List all backups

**GET** `/apps/{app_id}/backups/list`

Retrieves a list of metadata for all backups associated with the current API key.

**Response (200 OK):**
```json
{
  "backups": [
    {
      "filename": "backup-2025-09-01T10:00:00Z.json",
      "size": 12345,
      "modified": "2025-09-01T10:00:00Z",
      "etag": "d41d8cd98f00b204e9800998ecf8427e",
      "download_url": "..."
    }
  ]
}
```

### 3. Get latest backup metadata

**GET** `/apps/{app_id}/backups/latest`

Retrieves metadata for the most recently uploaded backup file.

**Response (200 OK):**
```json
{
  "filename": "backup-2025-09-03T12:34:56Z.json",
  "size": 12345,
  "modified": "2025-09-03T12:34:56Z",
  "etag": "d41d8cd98f00b204e9800998ecf8427e",
  "download_url": "..."
}
```

### 4. Manage a specific backup file

These endpoints operate on a specific file identified by its `{filename}`.

#### Download a backup

**GET** `/apps/{app_id}/backups/{filename}`

Downloads the raw content of the specified backup file.

**Response:** The raw JSON content of the backup file.

#### Update or create a backup (Upsert)

**PUT** `/apps/{app_id}/backups/{filename}`

Updates an existing backup file or creates a new one if it doesn't exist. This endpoint supports optimistic concurrency control.

**Headers:**
-   `If-Match` (string, optional): Provide the latest `ETag` of the file to prevent overwriting changes made by another client. If the ETag does not match, the server will respond with `412 Precondition Failed`.

**Request Body (`application/json`):**
-   The complete JSON data object to be saved.

**Response:**
-   `200 OK`: Backup was updated.
-   `201 Created`: Backup was created.

#### Delete a backup

**DELETE** `/apps/{app_id}/backups/{filename}`

Permanently deletes a specific backup file.

**Headers:**
-   `If-Match` (string, optional): Provide the latest `ETag` of the file to ensure you are deleting the version you expect.

**Response:**
-   `204 No Content`: The file was successfully deleted.

#### Get specific backup metadata

**GET** `/apps/{app_id}/backups/{filename}/meta`

Retrieves metadata for a single, specified backup file.

**Response (200 OK):**
```json
{
  "filename": "backup-2025-09-03T12:34:56Z.json",
  "size": 12345,
  "modified": "2025-09-03T12:34:56Z",
  "etag": "d41d8cd98f00b204e9800998ecf8427e",
  "download_url": "..."
}
```
