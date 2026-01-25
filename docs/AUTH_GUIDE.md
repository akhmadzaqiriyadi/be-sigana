# Authentication Guide for Frontend Developers

This backend implements a **Dual Authentication Strategy** using JWT (JSON Web Tokens). It supports both **Cookie-based** (httpOnly) and **Header-based** (Authorization: Bearer) authentication mechanisms to provide flexibility and security.

## 1. Registration Flow

**Endpoint:** `POST /api/v1/auth/register`

**Description:** Register a new user account. New users are created with `isVerified: false` by default and must wait for admin approval before they can login.

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Validation Rules:**
- `email`: Must be a valid email format
- `password`: Minimum 6 characters
- `name`: Minimum 3 characters

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful. Please wait for admin approval.",
  "data": {
    "id": "uuid-here",
    "email": "newuser@example.com",
    "name": "John Doe",
    "role": "RELAWAN",
    "isVerified": false,
    "createdAt": "2026-01-21T04:00:00.000Z"
  }
}
```

**Error Responses:**
- `409 Conflict`: Email already registered
- `400 Bad Request`: Validation error (missing/invalid fields)

**Important Notes:**
1. New users cannot login until an Admin verifies their account.
2. Admin can verify users via: `PATCH /api/v1/users/:id/verify`
3. Alternatively, Admin can create pre-verified users via: `POST /api/v1/users`

---

## 2. Login Flow

**Endpoint:** `POST /api/v1/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
On success, the backend does two things:
1.  **Sets an `httpOnly` Cookie** named `token` containing the JWT.
    *   This cookie is automatically handled by the browser for subsequent requests if `credentials: 'include'` is set.
2.  **Returns the JWT in the Response Body**:
    ```json
    {
      "success": true,
      "message": "Login successful",
      "data": {
        "user": { ... },
        "token": "eyJhbGci..." // <--- Use this for Header-based auth
      }
    }
    ```

**Error Responses:**
- `401 Unauthorized`: Invalid email or password
- `400 Bad Request`: Account not verified (pending admin approval)

---

## 3. Authenticated Requests (How to call protected APIs)

You can choose **ONE** of the following methods to authenticate your requests. You do NOT need both, but if both are provided, the Header takes precedence.

### Option A: Cookie-Based (Recommended for Web Apps)
This method is more secure against XSS because the token is in an `httpOnly` cookie and cannot be read by JavaScript.

*   **Requirement:** You must set `credentials: 'include'` (for fetch) or `withCredentials: true` (for axios) on **EVERY** request.
*   **How it works:** The browser automatically sends the `token` cookie to the backend.

**Example (Fetch):**
```javascript
fetch('http://localhost:8080/api/v1/auth/me', {
  method: 'GET',
  credentials: 'include' // <--- CRITICAL
});
```

**Example (Axios):**
```javascript
axios.get('http://localhost:8080/api/v1/auth/me', {
  withCredentials: true // <--- CRITICAL
});
```

### Option B: Header-Based (Alternative)
Use this if you prefer managing the token manually in `localStorage` or if Cookies are blocked (e.g., mobile apps, some cross-origin scenarios).

*   **Requirement:** You must attach the `Authorization` header.
*   **Format:** `Bearer <token>`

**Example:**
```javascript
const token = localStorage.getItem('token'); // Assuming you saved it after login

fetch('http://localhost:8080/api/v1/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## 4. Logout Flow

**Endpoint:** `POST /api/v1/auth/logout`

**Action:**
*   You should call this endpoint to clear the backend cookie.
*   **Frontend Responsibility:** You must also remove the token from `localStorage`/state if you are using Option B.

---

## 5. Troubleshooting: "Access token required" Error

If you are getting `401 Unauthorized` errors despite logging in:

### Common Issue: Localhost Cross-Origin Cookies
Since the frontend (`localhost:3000`) and backend (`localhost:8080`) are on different ports, modern browsers (Chrome/Edge) treat them as **Cross-Site**.

If you use **Option A (Cookies)**, the browser might block the cookie because of `SameSite` policies.

**Frontend Fixes:**

1.  **Use a Proxy (Best Practice):**
    Configure your frontend (Next.js/Vite) to proxy `/api` requests to `localhost:8080`. This makes everything look like `localhost:3000` to the browser, solving all cookie issues.
    *   **Next.js:** Use `rewrites()` in `next.config.js`.
    *   **Vite:** Use `server.proxy` in `vite.config.ts`.

2.  **Ensure Credentials are sent:**
    Double-check `credentials: 'include'` is present on the failing request.

3.  **Fallback to Header Auth:**
    If cookies are proving difficult in development, switch to **Option B** (Header-based) temporarily. Ensure you grab the `token` from the login response and send it in the header.

### Note on "Bearer undefined"
If you attempt to send an Authorization header, please ensure the token is valid. Sending `Authorization: Bearer undefined` will cause authentication to fail. The backend handles this gracefully now, but it indicates a bug in the frontend token retrieval logic.

---

## 6. User Profile Management

**Endpoint:** `PATCH /api/v1/users/profile`

**Description:** Allows the logged-in user to update their own profile information (currently just `name`).

**Request Body:**
```json
{
  "name": "Updated Name"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "...",
    "name": "Updated Name",
    "email": "..."
  }
}
```

