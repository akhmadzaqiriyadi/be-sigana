# User Management & CRUD Guide

## Overview
This document outlines the user management capabilities of the SiGana backend, including the full CRUD lifecycle and how Soft Delete is implemented.

## Soft Delete Mechanism
We utilize **Soft Deletes** instead of hard deletions to preserve data integrity and allow for potential recovery or auditing.

-   **Field**: `deletedAt` (DateTime, nullable) on the `users` table.
-   **Active User**: `deletedAt` is `null`.
-   **Deleted User**: `deletedAt` contains a timestamp.

**System Behavior:**
-   **Read (GET)**: All default queries (`findAll`, `findById`, `getPendingUsers`) automatically filter out users where `deletedAt` is NOT null.
-   **Delete (DELETE)**: The delete endpoint performs an update operation, setting `deletedAt` to the current timestamp.
-   **Update (PATCH/PUT)**: Update operations first check if the user is safe to update (i.e., not deleted).

---

## API Endpoints

### 1. Registration & Auth
*   **POST** `/api/v1/auth/register`: Create a new user (default role: RELAWAN, isVerified: false).
*   **POST** `/api/v1/auth/login`: Authenticate and receive token/cookies.

### 2. User Profile (Self)
*   **GET** `/api/v1/auth/me`: Get current user info.
*   **PATCH** `/api/v1/users/profile`: Update own profile (Name only).
    *   *Body*: `{ "name": "New Name" }`

### 3. User Management (Admin Only)
*   **GET** `/api/v1/users`: List all active users.
    *   *Filters*: `search` (name/email), `isVerified` (true/false), `role`.
    *   *Valid Roles*: `ADMIN`, `RELAWAN`, `STAKEHOLDER`.
*   **GET** `/api/v1/users/pending`: List users waiting for verification.
*   **GET** `/api/v1/users/:id`: Get specific user details.
*   **PUT** `/api/v1/users/:id`: Full update of user (Name, Role, Verified Status).
    *   *Body*: `{ "name": "...", "role": "ADMIN", "isVerified": true }`
*   **PATCH** `/api/v1/users/:id/verify`: Approve a pending user.
*   **DELETE** `/api/v1/users/:id`: **Soft delete** a user.

---

## Workflow Examples

### A. Verifying a New Volunteer
1.  Admin queries **GET** `/api/v1/users/pending` to see new registrations.
2.  Admin reviews the list.
3.  Admin calls **PATCH** `/api/v1/users/{id}/verify` to activate the account.
4.  User can now perform authorized actions.

### B. Deleting a User
1.  Admin calls **DELETE** `/api/v1/users/{user_id}`.
2.  Backend sets `deletedAt` timestamp.
3.  User is removed from lists and cannot login (if logic enforces it).
    *   *Note: Login logic should also check deletedAt if strictly enforced, current implementation focuses on list hiding.*

### C. Updating Profile
1.  User logs in.
2.  User calls **PATCH** `/api/v1/users/profile` with new name.
3.  Profile is updated immediately.
