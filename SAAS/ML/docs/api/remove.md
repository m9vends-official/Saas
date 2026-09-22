# Remove Device API

Unlinks a device from its owner (unsets owner field), or completely deletes the device from the database.

## Route

- **Method**: `DELETE`
- **URL**: `/api/device/:id`

## Request Format

This route uses a URL path parameter and an optional query parameter:

- `id` (string, required): The 24-character hexadecimal MongoDB ObjectId of the device to unlink or remove.
- `command` (string, query, optional): If set to `"remove"`, the device will be completely deleted from the database. If omitted, the device is only unlinked from its owner.

### Example Requests

- **Unlink Device (owner unset)**: `DELETE /api/device/60d5ec49f3e4e9001f3b2e99`
- **Remove Device Completely**: `DELETE /api/device/60d5ec49f3e4e9001f3b2e99?command=remove`

## Response Format

### Success Responses (200 OK)

#### Case 1: When unlinking the device (no `command=remove` query parameter)
```json
{
  "message": "Device Unlinked Successfully"
}
```

#### Case 2: When deleting the device completely (`?command=remove`)
```json
{
  "message": "Device Removed Successfully"
}
```

## Error Responses

### 400 Bad Request (Invalid Device ID format)

Returned if the `id` path parameter is not a valid 24-character hexadecimal ObjectId format. 
*Note: Due to internal service variable typing, the error message returned is `"Invalid User ID"` even though a device ID was validated.*

```json
{
  "message": "Invalid User ID"
}
```

### 500 Internal Server Error

Returned if the device with the specified `id` does not exist in the database.

```json
{
  "message": "No Device Exists"
}
```
