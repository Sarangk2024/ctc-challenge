# AI-First CRM HCP Module – Log Interaction Screen

This project is a modern, AI-first Customer Relationship Management (CRM) tool tailored for pharmaceutical field representatives interacting with Healthcare Professionals (HCPs). 

It implements the **Log Interaction Screen**, offering users the flexibility to log interactions with HCPs via either a **structured form** or a **conversational chat interface** powered by an AI Agent.

---

## Key Features

1. **Dual Chat & Form Synchronization**: Type meeting notes in plain conversational English on the left, and watch the AI Agent extract parameters (Summary, Date, Products discussed, Next Steps) and auto-populate the structured form fields on the right in real-time.
2. **LangGraph Agentic Tool Suite**: Fully incorporates a LangGraph agent that classifies, handles context, and triggers the following **5 mandatory tools**:
   - `get_hcp_profile`: Fetches demographic and medical clinic info alongside previous interaction history.
   - `log_interaction`: Summarizes inputs and commits new records to the CRM database.
   - `edit_interaction`: Updates details of existing database records from the interactive timeline edit panel.
   - `search_scientific_info`: Resolves scientific questions (dosage, drug monographs, clinical trial study rates).
   - `schedule_followup`: Schedules follow-up dispatches, calls, or calendar events.
3. **Clinical Timeline Tracker**: A history feed displaying past interactions with details (dates, length, topics, next steps) and a direct edit panel.
4. **Scheduled Task List**: Interactive checkbox interface enabling tracking of scheduled follow-up tasks.

---

## Architecture & Tech Stack

- **Frontend**: Next.js (App Router) with TypeScript, Redux Toolkit for state management, and Vanilla CSS with Google Inter font details.
- **Backend**: Python with FastAPI, Uvicorn, SQLAlchemy.
- **AI Agent Framework**: LangGraph, LangChain.
- **LLM Context**: Groq Cloud SDK using the `gemma2-9b-it` model (with automatic fallbacks).
- **Database**: SQLite (local server database initialized and pre-seeded automatically on launch).

---

## Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)
- **Groq API Key** (optional, fallback offline-parsing NLP engine is included to allow running all tools without external credentials).

---

### 2. Running the Backend Service

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. *(Optional)* Set up your Groq API Key:
   Create a `.env` file inside the `backend` folder and add:
   ```env
   GROQ_API_KEY=your_groq_api_token_here
   ```
5. Start the FastAPI server:
   ```bash
   python main.py
   ```
   *The server will initialize `crm.db`, seed mock HCP doctors (Dr. Sarah, Dr. James, Dr. Emily), and start listening on `http://127.0.0.1:8000`.*

---

### 3. Running the Frontend App

1. Navigate to the project root directory.
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000` to interact with the application.

---

## Project Structure

```
hcp-crm-log-interaction/
│
├── backend/
│   ├── main.py          # FastAPI application server & routes
│   ├── database.py      # SQLAlchemy models & DB seeding engine
│   ├── agent.py         # LangGraph workflow & message processing
│   ├── tools.py         # 5 sales/medical tool definitions
│   └── requirements.txt # Python package requirements
│
├── src/
│   ├── app/
│   │   ├── globals.css  # CSS custom variables & layouts
│   │   ├── layout.tsx   # Next.js app wrapper
│   │   └── page.tsx     # Home page routing
│   │
│   └── frontend/
│       ├── store/
│       │   └── store.ts # Redux store configuration & API slices
│       └── components/
│           ├── ReduxProvider.tsx
│           └── LogInteractionScreen.tsx # Core layout (split view)
│
├── package.json
├── tsconfig.json
└── README.md
```
