import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from database import init_db, SessionLocal, HCP, Interaction, Task
from agent import process_agent_message
from tools import log_interaction, edit_interaction

app = FastAPI(title="AI-First CRM HCP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Request/Response Schemas
class ChatRequest(BaseModel):
    message: str
    hcp_id: int
    history: Optional[List[Dict[str, str]]] = []

class InteractionCreate(BaseModel):
    hcp_id: int
    interaction_type: str
    date: str
    time: str
    attendees: Optional[str] = ""
    summary: str # discussed points
    materials_shared: Optional[str] = ""
    samples_distributed: Optional[str] = ""
    sentiment: Optional[str] = "Neutral"
    outcomes: Optional[str] = ""
    next_steps: Optional[str] = ""
    duration_mins: Optional[int] = 15

class InteractionUpdate(BaseModel):
    interaction_type: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    attendees: Optional[str] = None
    summary: Optional[str] = None
    materials_shared: Optional[str] = None
    samples_distributed: Optional[str] = None
    sentiment: Optional[str] = None
    outcomes: Optional[str] = None
    next_steps: Optional[str] = None

class TaskUpdate(BaseModel):
    status: str

# Endpoints
@app.post("/api/chat")
def chat_endpoint(req: ChatRequest):
    try:
        res = process_agent_message(req.message, req.hcp_id, req.history)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/hcps")
def get_hcps(db: Session = Depends(get_db)):
    hcps = db.query(HCP).all()
    return hcps

@app.get("/api/interactions")
def get_interactions(hcp_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Interaction)
    if hcp_id:
        query = query.filter(Interaction.hcp_id == hcp_id)
    interactions = query.order_by(Interaction.date.desc()).all()
    
    result = []
    for item in interactions:
        hcp = db.query(HCP).filter(HCP.id == item.hcp_id).first()
        result.append({
            "id": item.id,
            "hcp_id": item.hcp_id,
            "hcp_name": hcp.name if hcp else "Unknown",
            "interaction_type": item.interaction_type,
            "date": item.date,
            "time": item.time,
            "attendees": item.attendees,
            "summary": item.summary,
            "materials_shared": item.materials_shared,
            "samples_distributed": item.samples_distributed,
            "sentiment": item.sentiment,
            "outcomes": item.outcomes,
            "next_steps": item.next_steps,
            "duration_mins": item.duration_mins,
            "created_at": item.created_at
        })
    return result

@app.post("/api/interactions")
def create_interaction(req: InteractionCreate):
    try:
        res = log_interaction.invoke({
            "hcp_id": req.hcp_id,
            "interaction_type": req.interaction_type,
            "date": req.date,
            "time": req.time,
            "attendees": req.attendees,
            "summary": req.summary,
            "materials_shared": req.materials_shared,
            "samples_distributed": req.samples_distributed,
            "sentiment": req.sentiment,
            "outcomes": req.outcomes,
            "next_steps": req.next_steps,
            "duration_mins": req.duration_mins
        })
        import json
        return json.loads(res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/interactions/{id}")
def update_interaction_endpoint(id: int, req: InteractionUpdate):
    try:
        res = edit_interaction.invoke({
            "interaction_id": id,
            "interaction_type": req.interaction_type,
            "date": req.date,
            "time": req.time,
            "attendees": req.attendees,
            "summary": req.summary,
            "materials_shared": req.materials_shared,
            "samples_distributed": req.samples_distributed,
            "sentiment": req.sentiment,
            "outcomes": req.outcomes,
            "next_steps": req.next_steps
        })
        import json
        return json.loads(res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tasks")
def get_tasks(hcp_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Task)
    if hcp_id:
        query = query.filter(Task.hcp_id == hcp_id)
    tasks = query.order_by(Task.due_date.asc()).all()
    
    result = []
    for item in tasks:
        hcp = db.query(HCP).filter(HCP.id == item.hcp_id).first()
        result.append({
            "id": item.id,
            "hcp_id": item.hcp_id,
            "hcp_name": hcp.name if hcp else "Unknown",
            "due_date": item.due_date,
            "activity_type": item.activity_type,
            "status": item.status
        })
    return result

@app.put("/api/tasks/{id}")
def update_task_status(id: int, req: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = req.status
    db.commit()
    return {"status": "Success", "message": f"Task status updated to {req.status}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
