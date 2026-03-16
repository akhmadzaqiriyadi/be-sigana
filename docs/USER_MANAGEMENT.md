# User Management & CRUD Guide

## Overview

This document outlines the user management capabilities of the SiGana backend, including the full CRUD lifecycle and how Soft Delete is implemented.

## Current User Model

User object untuk admin kini mencakup:

- `id`, `email`, `name`, `role`
- `status` (`PENDING`, `ACTIVE`, `SUSPENDED`, `DELETED`)
- `isVerified`
- `phone`, `nik`
- `lastLoginAt`, `createdAt`
- `village` (`id`, `name`, `districts`)

## Soft Delete Mechanism

We utilize **Soft Deletes** instead of hard deletions to preserve data integrity and allow for potential recovery or auditing.

- **Field**: `deletedAt` (DateTime, nullable) on the `users` table.
- **Active User**: `deletedAt` is `null`.
- **Deleted User**: `deletedAt` contains a timestamp.

**System Behavior:**

- **Read (GET)**: All default queries (`findAll`, `findById`, `getPendingUsers`) automatically filter out users where `deletedAt` is NOT null.
- **Delete (DELETE)**: The delete endpoint performs an update operation, setting `deletedAt` to the current timestamp.
- **Update (PATCH/PUT)**: Update operations first check if the user is safe to update (i.e., not deleted).

---

## API Endpoints

### 1. Registration & Auth

- **POST** `/api/v1/auth/register`: Create a new user (default role: RELAWAN, isVerified: false).
- **POST** `/api/v1/auth/login`: Authenticate and receive token/cookies.

### 2. User Profile (Self)

- **GET** `/api/v1/auth/me`: Get current user info.
- **PATCH** `/api/v1/users/profile`: Update own profile (Name only).
  - _Body_: `{ "name": "New Name" }`
- **PATCH** `/api/v1/users/me/password`: Ubah password akun sendiri.
  - _Body_: `{ "currentPassword": "...", "newPassword": "..." }`

### 3. User Management (Admin Only)

- **GET** `/api/v1/users`: List all active users.
  - _Filters_: `search` (name/email), `isVerified` (true/false), `role`, `status`.
  - _Valid Roles_: `ADMIN`, `RELAWAN`, `STAKEHOLDER`.
  - _Response_: mendukung `meta` pagination + `summary` statistik user.
- **GET** `/api/v1/users/summary`: Ambil ringkasan statistik user untuk header dashboard admin.
- **GET** `/api/v1/users/pending`: List users waiting for verification.
- **GET** `/api/v1/users/:id`: Get specific user details.
- **GET** `/api/v1/users/:id/activity-logs?page=1&limit=10`: Ambil riwayat aktivitas terkait user.
- **PUT** `/api/v1/users/:id`: Full update of user.
- **PATCH** `/api/v1/users/:id`: Partial update user.
  - _Body fields_: `name`, `role`, `isVerified`, `phone`, `nik`, `villageId`
- **PATCH** `/api/v1/users/:id/password`: Reset password user oleh admin.
  - _Body_: `{ "newPassword": "..." }`
- **PATCH** `/api/v1/users/:id/status`: Update status user secara terkontrol.
  - _Body_: `{ "status": "ACTIVE|PENDING|SUSPENDED" }`
- **PATCH** `/api/v1/users/:id/verify`: Approve a pending user.
- **DELETE** `/api/v1/users/:id`: **Soft delete** a user.
- **POST** `/api/v1/users/bulk/verify`: Verifikasi massal.
  - _Body_: `{ "userIds": ["uuid", "..."] }`
- **POST** `/api/v1/users/bulk/delete`: Hapus (soft delete) massal.
  - _Body_: `{ "userIds": ["uuid", "..."] }`
- **POST** `/api/v1/users/bulk/role`: Ubah role massal.
  - _Body_: `{ "userIds": ["uuid", "..."], "role": "RELAWAN|ADMIN|STAKEHOLDER" }`

Catatan bulk action:

- Maksimal 200 user per request.
- Response mengembalikan `{ requested, affected, skipped }`.

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
3.  Backend juga set `status = DELETED`.
4.  User is removed from lists and login akan ditolak.

### C. Updating Profile

1.  User logs in.
2.  User calls **PATCH** `/api/v1/users/profile` with new name.
3.  Profile is updated immediately.
