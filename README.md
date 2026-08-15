# CivicFix Backend — Core Engine

A FastAPI and SQLite backend engine for reporting, classifying, and managing local civic issues (such as water leaks, road defects, vandalism, etc.).

---

## 🛠 Tech Stack & Setup

* **Framework**: FastAPI (Python 3.14+)
* **Database**: SQLite3 (persistent file-based storage)
* **Testing**: pytest & FastAPI TestClient

### 🚀 Getting Started

1. **Activate Virtual Environment**:
   ```powershell
   .venv\Scripts\Activate.ps1
   ```
2. **Install Dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```
3. **Environment Setup**:
   Create a `.env` file at the root directory (refer to `.env.example`):
   ```text
   DATABASE_PATH=backend/data/civic_issue.db
   HOST=127.0.0.1
   PORT=8000
   ```
4. **Run the Server**:
   ```powershell
   .venv\Scripts\python -m uvicorn backend.app.main:app --reload
   ```
   The interactive API docs will be available at **`http://127.0.0.1:8000/docs`**.

---

## 📡 REST API Documentation

All endpoints are prefixed with `/api`.

### 1. `POST /api/reports/`
Create a new civic issue report.

* **Request Headers**: `Content-Type: application/json`
* **Request Body Example**:
  ```json
  {
    "title": "Broken street light",
    "description": "Street light has been flickering and is now dark.",
    "category": "Electricity",
    "latitude": 16.1234,
    "longitude": 81.5678,
    "image_url": "https://example.com/image.jpg"
  }
  ```
* **Response Body (201 Created)**:
  ```json
  {
    "id": 1,
    "title": "Broken street light",
    "description": "Street light has been flickering and is now dark.",
    "category": "Electricity",
    "latitude": 16.1234,
    "longitude": 81.5678,
    "image_url": "https://example.com/image.jpg",
    "status": "Reported",
    "ai_priority": "Medium",
    "admin_notes": null,
    "created_at": "2026-08-15T10:00:00.000000"
  }
  ```

---

### 2. `GET /api/reports/`
Fetch all reports. Supports optional combinable filters for admin views.

* **Query Parameters**:
  * `status` (values: `Reported`, `In Review`, `Resolved`)
  * `priority` (values: `High`, `Medium`, `Low`)
  * `category` (string matching)
* **Example Requests**:
  * `GET /api/reports/` (Retrieve all reports)
  * `GET /api/reports/?status=Reported`
  * `GET /api/reports/?priority=High&status=In+Review`
* **Response Body (200 OK)**:
  ```json
  [
    {
      "id": 1,
      "title": "Broken street light",
      "description": "Street light has been flickering and is now dark.",
      "category": "Electricity",
      "latitude": 16.1234,
      "longitude": 81.5678,
      "image_url": "https://example.com/image.jpg",
      "status": "Reported",
      "ai_priority": "Medium",
      "admin_notes": null,
      "created_at": "2026-08-15T10:00:00.000000"
    }
  ]
  ```

---

### 3. `PATCH /api/reports/{id}/`
Allows an administrator to update the status and add resolution notes to a report. Supports partial updates.

* **URL Parameter**: `id` (integer)
* **Request Body Example**:
  ```json
  {
    "status": "In Review",
    "admin_notes": "Assigned maintenance team dispatched."
  }
  ```
* **Response Body (200 OK)**:
  ```json
  {
    "id": 1,
    "title": "Broken street light",
    "description": "Street light has been flickering and is now dark.",
    "category": "Electricity",
    "latitude": 16.1234,
    "longitude": 81.5678,
    "image_url": "https://example.com/image.jpg",
    "status": "In Review",
    "ai_priority": "Medium",
    "admin_notes": "Assigned maintenance team dispatched.",
    "created_at": "2026-08-15T10:00:00.000000"
  }
  ```

---

## 🧪 Testing
The backend contains automated integration tests verifying persistence, input validations, coordinates bounds, filters, and patches.

To run the test suite:
```powershell
.venv\Scripts\python -m pytest backend/tests/
```
