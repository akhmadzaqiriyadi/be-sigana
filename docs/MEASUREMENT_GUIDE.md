# Measurement & Anthropometry Guide

This document outlines the measurement recording, Z-Score calculation, offline synchronization, and public sharing features.

## 1. Z-Score Calculation (Offline First)

SiGana adopts an **Offline First** approach. The Frontend handles the immediate calculation of nutritional status (Z-Score) to provide instant feedback to the user, even without an internet connection.

### Workflow

1.  **Input**: Weight, Height, Age (calculated from DOB), and Gender.
2.  **Calculation**: Frontend calculates `BB/U`, `TB/U`, `BB/TB` statuses using WHO standards locally.
3.  **Storage**: Data + Calculated Status is saved to IndexedDB (local).
4.  **Sync**: Data is sent to the Backend when online. Backend **recalculates** the Z-Score to validate and ensure data integrity.

### Data Fields

When sending data to `POST /api/v1/measurements` or `/sync`, you can include the optional status fields:

```json
{
  "balitaId": "uuid",
  "beratBadan": 10.5,
  "tinggiBadan": 85.0,
  "posisiUkur": "TERLENTANG",

  // Optional: Frontend Calculated Status
  "bb_u_status": "Gizi Baik",
  "tb_u_status": "Normal",
  "bb_tb_status": "Gizi Baik",
  "statusAkhir": "HIJAU"
}
```

---

## 2. Public Share Feature (Privacy Protected)

Measurements can be shared via a public link. To protect the child's privacy, we implement a **Challenge-Response** mechanism using the Date of Birth (DOB).

### Flow for "Share Link"

1.  **Public Page Load**: Frontend calls `GET /api/v1/measurements/{id}/public`.
    - Returns: Masked Name (e.g., "B*** S***"), Gender, Posko Name.
    - _No sensitive data (DOB, Parent Name) is returned._
2.  **Challenge**: User inputs the Child's Date of Birth (DOB).
3.  **Verification**: Frontend calls `POST /api/v1/measurements/{id}/access` with the DOB.
4.  **Result**:
    - If DOB matches: Backend returns full measurement details.
    - If mismatch: Backend returns `403 Forbidden`.

### Endpoints

#### A. Get Public Info

`GET /api/v1/measurements/{id}/public`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "maskedName": "B*** S***",
    "gender": "L",
    "createdAt": "2024-02-14T10:00:00Z",
    "poskoName": "Posko Mawar"
  }
}
```

#### B. Verify Access

`POST /api/v1/measurements/{id}/access`

**Body:**

```json
{ "dob": "2023-05-20" }
```

**Response (Success):**

```json
{
  "success": true,
  "data": {
    "balita": {
      "namaAnak": "Budi Santoso",
      "tanggalLahir": "2023-05-20",
      "jenisKelamin": "L",
      "posko": { "name": "Posko Mawar" },
      ...
    },
    // Array of raw measurement data (Frontend calculates Z-Score)
    "measurements": [
      {
        "beratBadan": 10.5,
        "tinggiBadan": 85.0,
        "lingkarKepala": 45.0,
        "lila": 15.0,
        "recordedAt": "2024-02-14T00:00:00Z"
      }
    ]
  }
}
```

---

## 3. Synchronization (Sync)

Used for submitting offline data and pulling updates (Delta Sync).

### Push (Upload Offline Data)

`POST /api/v1/measurements/sync`

- Accepts an array of measurements.
- Handles `localId` mapping to backend real IDs.

### Pull (Download Updates)

`GET /api/v1/measurements/sync-pull?lastSync={ISO_DATE}`

- Returns records created, updated, or deleted since `lastSync`.
- Deleted records have a `deletedAt` timestamp (Tombstone).
