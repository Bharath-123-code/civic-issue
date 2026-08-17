<div align="center">
  
  <h1>🏙️ CivicFix</h1>

  <p>
    <strong>A next-generation platform for reporting, classifying, and managing local civic issues.</strong>
  </p>

  <p>
    <a href="#-features">Features</a> •
    <a href="#%EF%B8%8F-tech-stack">Tech Stack</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-api-overview">API</a> 
  </p>
  
  <br/>

  ![Python](https://img.shields.io/badge/Python-3.14+-3776AB?style=for-the-badge&logo=python&logoColor=white)
  ![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
  ![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)
  ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
  ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
  ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

</div>

<br/>

> **CivicFix** bridges the gap between citizens and city administration. It empowers residents to report problems—like water leaks, road defects, or vandalism—with an intuitive interface, while providing city administrators a powerful dashboard to track, categorize, and resolve these issues efficiently.

---

## ✨ Features

<table>
  <tr>
    <td width="50%">
      <h3>🏠 Resident Portal</h3>
      <p>An easy-to-use, responsive interface for residents to seamlessly report new civic issues. Automatically categorizes and prioritizes based on the input.</p>
    </td>
    <td width="50%">
      <h3>🛡️ Admin Dashboard</h3>
      <p>A centralized, bird's-eye management view for city admins to review incoming reports, update statuses, and leave resolution notes.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📡 RESTful API</h3>
      <p>A robust backend API powering the platform, featuring endpoints for fetching, updating, and filtering reports efficiently.</p>
    </td>
    <td width="50%">
      <h3>💾 Persistent Storage</h3>
      <p>Lightweight, reliable, and entirely file-based using SQLite—making it incredibly easy to set up, backup, and maintain.</p>
    </td>
  </tr>
</table>

---

## 🛠️ Tech Stack

- **Core Engine:** FastAPI (Python)
- **Data Persistence:** SQLite3
- **Frontend Architecture:** Vanilla HTML, CSS, JavaScript
- **Static Delivery:** Served blazingly fast directly via FastAPI
- **Quality Assurance:** pytest & FastAPI TestClient

---

## 🚀 Getting Started

Follow these instructions to get a local copy of CivicFix up and running.

<details>
<summary><b>Step 1: Prerequisites & Environment</b></summary>
<br>

Make sure you have **Python** installed on your system.

Create and activate a virtual environment:
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```
</details>

<details>
<summary><b>Step 2: Install Dependencies</b></summary>
<br>

Install the required packages from `requirements.txt`:
```powershell
pip install -r requirements.txt
```
</details>

<details>
<summary><b>Step 3: Configuration</b></summary>
<br>

Create a `.env` file at the root directory. You can use `.env.example` as a template:
```env
DATABASE_PATH=backend/data/civic_issue.db
HOST=127.0.0.1
PORT=8000
```
</details>

<details>
<summary><b>Step 4: Boot up the Server</b></summary>
<br>

Start the application with Uvicorn:
```powershell
.venv\Scripts\python -m uvicorn backend.app.main:app --reload
```
</details>

<br>

### 🌐 Accessing the Portals

Once the server is running, the magic happens here:

- 🏠 **Resident Portal:** [`http://127.0.0.1:8000/resident/`](http://127.0.0.1:8000/resident/)
- 🛡️ **Admin Dashboard:** [`http://127.0.0.1:8000/admin/`](http://127.0.0.1:8000/admin/)
- 📚 **API Documentation:** [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs)

---

## 📡 API Overview

All backend interactions happen under the `/api` prefix. The platform provides a beautiful, interactive **OpenAPI UI** at `/docs`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/reports/` | Submit a new civic issue report. |
| `GET` | `/api/reports/` | Fetch reports. Supports filters (`status`, `priority`, `category`). |
| `PATCH` | `/api/reports/{id}/` | Update status and add admin resolution notes. |

---

## 🧪 Testing

The backend includes a comprehensive suite of automated integration tests that verify data persistence, input validations, and routing.

To run the tests:
```powershell
.venv\Scripts\python -m pytest backend/tests/
```

---

<div align="center">
  <p><i>Building better cities, together.</i></p>
</div>
