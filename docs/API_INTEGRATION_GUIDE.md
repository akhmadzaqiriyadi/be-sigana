# SiGana API Integration Guide

This document provides a comprehensive guide for Frontend developers on how to integrate with the SiGana API. It covers standard response formats, pagination, error handling, and best practices.

---

## 1. Response Structure

All API responses (GET, POST, PUT, DELETE, PATCH) follow a strict standardized JSON format. You can rely on the `success` field to determine if the request passed or failed.

### A. Success Response (200, 201)

```json
{
  "success": true,
  "message": "Operation successful description",
  "data": { ... }, // Payload (Object or Array)
  "meta": {        // Optional: Pagination Info
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

### B. Error Response (400, 401, 403, 404, 500)

```json
{
  "success": false,
  "message": "Email already registered", // Display this to the user
  "error": "..." // Optional: Technical details (Dev mode only)
}
```

---

## 2. Pagination

For list endpoints (e.g., `/users`, `/measurements`), pagination is enabled by default.

### Request Params

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

**Example Request:**
`GET /api/v1/users?page=2&limit=20`

### Handling Response

Use the `meta` object to build your pagination UI:

```json
"meta": {
  "page": 2,          // Current Page
  "limit": 20,        // Per Page
  "total": 100,       // Total Items count
  "totalPages": 5     // Total Pages count
}
```

---

## 3. Errors & HTTP Status Codes

| Status Code          | Meaning               | Handling Strategy                                  |
| :------------------- | :-------------------- | :------------------------------------------------- |
| **200 OK**           | Success               | Show "data".                                       |
| **201 Created**      | Resource Created      | Show success message, redirect if needed.          |
| **400 Bad Request**  | Validation Error      | Show `message` (e.g., "Invalid email format").     |
| **401 Unauthorized** | Token missing/invalid | **Redirect to Login**. Token expired or cleared.   |
| **403 Forbidden**    | Role mismatch         | Show "Access Denied". User lacks permission.       |
| **404 Not Found**    | ID/Path not found     | Show 404 page or "Data not found".                 |
| **500 Server Error** | Backend Issue         | Show generic error toast ("Something went wrong"). |

---

## 4. Frontend Integration Example (TypeScript)

Here is a recommended setup for your API client to handle these responses automatically.

### A. Interfaces

```typescript
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ApiError {
  success: false;
  message: string;
}
```

### B. Fetch Wrapper Example

```typescript
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      // Credentials 'include' is CRITICAL for Cookie Auth
      credentials: "include",
    }
  );

  const body = await response.json();

  if (!response.ok || !body.success) {
    // 401 handling usually happens here
    if (response.status === 401) {
      window.location.href = "/login";
    }
    throw new Error(body.message || "An error occurred");
  }

  return body;
}

// Usage
const getUsers = async (page = 1) => {
  try {
    const res = await fetchApi<User[]>(`/users?page=${page}`);
    console.log(res.data); // User[]
    console.log(res.meta); // Pagination
  } catch (error) {
    alert(error.message);
  }
};
```

---

## 6. Documentation Links

- [Authentication Guide](./AUTH_GUIDE.md)
- [User Management Guide](./USER_MANAGEMENT.md)
- [Measurement & Sync Guide](./MEASUREMENT_GUIDE.md)
