import json
from datetime import datetime
from langchain_core.tools import tool
from database import SessionLocal, HCP, Interaction, Task

# Mock Medical Knowledge Base for search_scientific_info tool
MEDICAL_KNOWLEDGE_BASE = {
    "lipitor": "Lipitor (Atorvastatin): Lipid-lowering agent. Indicated for reduction of total cholesterol, LDL-C, and triglycerides. Standard starting dose is 10-20 mg once daily; dosage range is 10-80 mg once daily. Key studies (ASCOT-LLA) show 36% reduction in non-fatal MI and fatal CHD.",
    "humira": "Humira (Adalimumab): TNF blocker. Indicated for Rheumatoid Arthritis, Psoriatic Arthritis, Crohn's Disease, and Plaque Psoriasis. Administered via subcutaneous injection (40 mg every other week). Key safety warning: serious infection risk, tuberculosis screening required.",
    "keytruda": "Keytruda (Pembrolizumab): Programmed Death Receptor-1 (PD-1) blocking antibody. Indicated for Melanoma, NSCLC, Head and Neck Cancer, Hodgkin Lymphoma. Recommended dosage is 200 mg every 3 weeks or 400 mg every 6 weeks as an IV infusion over 30 minutes. High response rate in PD-L1 positive tumors.",
    "oncoboost": "OncoBoost: Novel clinical adjuvant therapeutic displaying a 42% improvement in progression-free survival (PFS) in Phase III clinical trials for triple-negative breast cancer cohort. Standard infusion cycles are bi-weekly for 12 weeks. High tolerability profile.",
    "efficacy": "Clinical trial results show our main products achieve statistically significant primary end-points (p < 0.01) relative to active controls, with standard safety profiles.",
    "dosage": "Ensure checking patient renal and hepatic parameters before prescribing. Adjust Lipitor down to 10mg in geriatric cohorts if concurrent with CYP3A4 inhibitors."
}

@tool
def get_hcp_profile(hcp_id: int) -> str:
    """Retrieves detailed profile, specialty, clinic details, and past interaction history for a given Healthcare Professional (HCP) ID."""
    db = SessionLocal()
    try:
        hcp = db.query(HCP).filter(HCP.id == hcp_id).first()
        if not hcp:
            return f"Error: HCP with ID {hcp_id} not found."
        
        interactions = db.query(Interaction).filter(Interaction.hcp_id == hcp_id).order_by(Interaction.date.desc()).all()
        history = []
        for i in interactions:
            history.append({
                "interaction_id": i.id,
                "type": i.interaction_type,
                "date": i.date,
                "time": i.time,
                "attendees": i.attendees,
                "summary": i.summary,
                "materials_shared": i.materials_shared,
                "samples_distributed": i.samples_distributed,
                "sentiment": i.sentiment,
                "outcomes": i.outcomes,
                "next_steps": i.next_steps
            })
            
        profile = {
            "id": hcp.id,
            "name": hcp.name,
            "specialty": hcp.specialty,
            "clinic": hcp.clinic_name,
            "email": hcp.email,
            "phone": hcp.phone,
            "address": hcp.address,
            "interaction_history": history
        }
        return json.dumps(profile, indent=2)
    except Exception as e:
        return f"Error retrieving HCP profile: {str(e)}"
    finally:
        db.close()

@tool
def log_interaction(
    hcp_id: int, 
    summary: str, 
    interaction_type: str = "Meeting",
    date: str = None, 
    time: str = None,
    attendees: str = None,
    materials_shared: str = None,
    samples_distributed: str = None,
    sentiment: str = "Neutral",
    outcomes: str = None,
    next_steps: str = None, 
    duration_mins: int = 15
) -> str:
    """Logs a new interaction with a Healthcare Professional (HCP). 
    Captures interaction details: type, date, time, attendees, summary of topics, materials shared, samples distributed, sentiment, outcomes, and next steps.
    """
    db = SessionLocal()
    try:
        hcp = db.query(HCP).filter(HCP.id == hcp_id).first()
        if not hcp:
            return f"Error: Cannot log interaction. HCP ID {hcp_id} not found."

        log_date = date if date else datetime.now().strftime("%Y-%m-%d")
        log_time = time if time else datetime.now().strftime("%H:%M")
        
        interaction = Interaction(
            hcp_id=hcp_id,
            interaction_type=interaction_type,
            date=log_date,
            time=log_time,
            attendees=attendees,
            summary=summary,
            materials_shared=materials_shared,
            samples_distributed=samples_distributed,
            sentiment=sentiment,
            outcomes=outcomes,
            next_steps=next_steps,
            duration_mins=duration_mins
        )
        db.add(interaction)
        db.commit()
        db.refresh(interaction)

        if next_steps:
            task = Task(
                hcp_id=hcp_id,
                interaction_id=interaction.id,
                due_date=(datetime.now().strftime("%Y-%m-%d")),
                activity_type=next_steps,
                status="Pending"
            )
            db.add(task)
            db.commit()

        result = {
            "status": "Success",
            "message": f"Successfully logged interaction with {hcp.name} on {log_date}.",
            "interaction_id": interaction.id,
            "hcp_name": hcp.name,
            "type": interaction_type,
            "date": log_date,
            "time": log_time,
            "attendees": attendees,
            "summary": summary,
            "materials_shared": materials_shared,
            "samples_distributed": samples_distributed,
            "sentiment": sentiment,
            "outcomes": outcomes,
            "next_steps": next_steps
        }
        return json.dumps(result, indent=2)
    except Exception as e:
        db.rollback()
        return f"Error logging interaction: {str(e)}"
    finally:
        db.close()

@tool
def edit_interaction(
    interaction_id: int, 
    summary: str = None, 
    interaction_type: str = None,
    date: str = None, 
    time: str = None,
    attendees: str = None,
    materials_shared: str = None,
    samples_distributed: str = None,
    sentiment: str = None,
    outcomes: str = None,
    next_steps: str = None
) -> str:
    """Edits/modifies an existing logged interaction details by its ID. Provide only the fields that need updating."""
    db = SessionLocal()
    try:
        interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
        if not interaction:
            return f"Error: Interaction with ID {interaction_id} not found."

        if summary is not None:
            interaction.summary = summary
        if interaction_type is not None:
            interaction.interaction_type = interaction_type
        if date is not None:
            interaction.date = date
        if time is not None:
            interaction.time = time
        if attendees is not None:
            interaction.attendees = attendees
        if materials_shared is not None:
            interaction.materials_shared = materials_shared
        if samples_distributed is not None:
            interaction.samples_distributed = samples_distributed
        if sentiment is not None:
            interaction.sentiment = sentiment
        if outcomes is not None:
            interaction.outcomes = outcomes
        if next_steps is not None:
            interaction.next_steps = next_steps
            existing_task = db.query(Task).filter(Task.interaction_id == interaction_id).first()
            if existing_task:
                existing_task.activity_type = next_steps
            else:
                task = Task(
                    hcp_id=interaction.hcp_id,
                    interaction_id=interaction.id,
                    due_date=interaction.date,
                    activity_type=next_steps,
                    status="Pending"
                )
                db.add(task)

        db.commit()
        db.refresh(interaction)

        hcp = db.query(HCP).filter(HCP.id == interaction.hcp_id).first()
        result = {
            "status": "Success",
            "message": f"Interaction {interaction_id} successfully updated.",
            "interaction": {
                "id": interaction.id,
                "hcp_name": hcp.name if hcp else "Unknown",
                "type": interaction.interaction_type,
                "date": interaction.date,
                "time": interaction.time,
                "attendees": interaction.attendees,
                "summary": interaction.summary,
                "materials_shared": interaction.materials_shared,
                "samples_distributed": interaction.samples_distributed,
                "sentiment": interaction.sentiment,
                "outcomes": interaction.outcomes,
                "next_steps": interaction.next_steps
            }
        }
        return json.dumps(result, indent=2)
    except Exception as e:
        db.rollback()
        return f"Error updating interaction: {str(e)}"
    finally:
        db.close()

@tool
def search_scientific_info(query: str) -> str:
    """Searches clinical literature, drug dosages, study data, or safety guidelines. 
    Use this tool to find medical facts, trial percentages, and product efficacy questions.
    """
    cleaned_query = query.lower()
    results = []
    for key, val in MEDICAL_KNOWLEDGE_BASE.items():
        if key in cleaned_query:
            results.append(val)
    
    if not results:
        return f"No specific clinical monograph found for '{query}'. Generic guidance: Refer to product packaging inserts or contact the Medical Information Department."
    
    return "\n\n".join(results)

@tool
def schedule_followup(hcp_id: int, activity_type: str, due_date: str) -> str:
    """Schedules a new follow-up activity (e.g. 'Email Study Sheets', 'Follow-up Call') for a specified HCP and due date."""
    db = SessionLocal()
    try:
        hcp = db.query(HCP).filter(HCP.id == hcp_id).first()
        if not hcp:
            return f"Error: Cannot schedule task. HCP with ID {hcp_id} not found."

        task = Task(
            hcp_id=hcp_id,
            due_date=due_date,
            activity_type=activity_type,
            status="Pending"
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        result = {
            "status": "Success",
            "message": f"Successfully scheduled follow-up for {hcp.name}.",
            "task_id": task.id,
            "hcp_name": hcp.name,
            "due_date": task.due_date,
            "activity": task.activity_type
        }
        return json.dumps(result, indent=2)
    except Exception as e:
        db.rollback()
        return f"Error scheduling task: {str(e)}"
    finally:
        db.close()

@tool
def calculate_sales_metrics(hcp_id: int) -> str:
    """Calculates sales and visit performance metrics for a specific Healthcare Professional (HCP) ID, 
    such as total count of logged interactions, total engagement duration, and pending task count.
    """
    db = SessionLocal()
    try:
        hcp = db.query(HCP).filter(HCP.id == hcp_id).first()
        if not hcp:
            return f"Error: HCP with ID {hcp_id} not found."
            
        interactions = db.query(Interaction).filter(Interaction.hcp_id == hcp_id).all()
        tasks = db.query(Task).filter(Task.hcp_id == hcp_id).all()
        
        visit_count = len(interactions)
        total_duration = sum(item.duration_mins for item in interactions)
        pending_tasks = sum(1 for t in tasks if t.status == 'Pending')
        
        # Summarize discussion focus
        topics = []
        for i in interactions:
            if i.summary:
                topics.append(i.summary)
        unique_topics = list(set(topics))
        focus = ", ".join(unique_topics) if unique_topics else "None logged yet"
        
        result = {
            "status": "Success",
            "hcp_name": hcp.name,
            "metrics": {
                "total_interactions_logged": visit_count,
                "total_duration_minutes": total_duration,
                "pending_followup_tasks": pending_tasks,
                "discussion_focus": focus
            }
        }
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"Error calculating metrics: {str(e)}"
    finally:
        db.close()
