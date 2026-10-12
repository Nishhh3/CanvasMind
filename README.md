# CanvasMind 🧠

**CanvasMind** is an AI-powered interactive canvas designed to help users organize notes, understand concepts, and improve their learning experience through AI-assisted tools.

## 🚀 Getting Started

Follow these instructions to set up and run CanvasMind locally.

### 📋 Prerequisites

Make sure you have installed:

- Python 3.10+
- Node.js and npm
- Git

## 📁 Project Structure

```text
CanvasMind/
├── backend/
│   └── app/
│       └── main.py
├── frontend/
│   ├── src/
│   ├── package.json
│   └── ...
└── README.md
```

_Note: The structure above is illustrative. Adjust folder names if your actual project differs._

## ⚙️ Backend Setup

### 1. Navigate to the backend directory

```bash
cd backend
```

### 2. Install dependencies

Install the Python dependencies specified in your project:

```bash
pip install -r requirements.txt
```

If your project does not have a `requirements.txt` file, install the required packages individually.

### 3. Start the backend server

```bash
uvicorn app.main:app --reload --port 8000
```

The backend server will run at:

**http://localhost:8000**

If the backend uses FastAPI, interactive API documentation is available at:

**http://localhost:8000/docs**

## 💻 Frontend Setup

### 1. Navigate to the frontend directory

Open a new terminal and run:

```bash
cd frontend
```

### 2. Install project dependencies

```bash
npm install
```

Install the additional required packages:

```bash
npm install zustand jspdf react-markdown @dnd-kit/core @dnd-kit/sortable react-dropzone perfect-freehand lucide-react
```

### 3. Run TypeScript checks

```bash
npx tsc --noEmit
```

### 4. Run ESLint

```bash
npm run lint
```

### 5. Build the frontend

```bash
npm run build
```

### 6. Start the development server

```bash
npm run dev
```

The frontend will typically be available at:

**http://localhost:3000**

Check the terminal output for the actual URL if a different port is assigned.

## ▶️ Running the Project

Run the backend and frontend in **two separate terminals**.

**Terminal 1 — Backend**

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

Once both servers are running, open the frontend URL in your browser.

## 🛠️ Tech Stack

| Category           | Technologies               |
| ------------------ | -------------------------- |
| Frontend           | Next.js, React, TypeScript |
| Styling            | Tailwind CSS               |
| State Management   | Zustand                    |
| Backend            | Python, FastAPI, Uvicorn   |
| AI Integration     | AI-powered assistance      |
| Markdown Rendering | react-markdown             |
| PDF Generation     | jsPDF                      |
| Drag and Drop      | dnd-kit                    |
| File Uploads       | react-dropzone             |
| Canvas Drawing     | perfect-freehand           |
| Icons              | lucide-react               |

_The stack above reflects the provided commands and project context; verify optional integrations against the actual source code._

## 🧪 Development Checks

Before committing changes, run these commands inside the `frontend` directory:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Resolve any errors before pushing your changes to GitHub.

## 🔧 Troubleshooting

- **Backend import error:** Ensure you run Uvicorn from the directory containing the `app` package.
- **Missing Python packages:** Install the dependencies listed in `requirements.txt`.
- **Frontend dependency errors:** Run `npm install` inside the frontend directory.
- **TypeScript errors:** Run `npx tsc --noEmit` to identify type issues.
- **Lint errors:** Run `npm run lint` and fix the reported ESLint issues.
- **Port already in use:** Stop the process using the port or configure a different port.
- **Frontend cannot reach backend:** Verify that the backend is running on port `8000` and check the frontend API configuration.

## 🤝 Contributing

1. Clone the repository.
2. Create a new feature branch.
3. Make your changes.
4. Run the TypeScript, lint, and build checks.
5. Commit and push your changes.
6. Open a pull request.

## 📄Developer

Nishant Chauhan

---

**CanvasMind — Learn, organize, and create on an intelligent canvas.**
