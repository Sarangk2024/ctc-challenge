import os
import json
import re
from typing import TypedDict, Sequence, Dict, Any
from dotenv import load_dotenv

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
from tools import get_hcp_profile, log_interaction, edit_interaction, search_scientific_info, schedule_followup, calculate_sales_metrics

load_dotenv()

# Define LangGraph State
class AgentState(TypedDict):
    messages: Sequence[BaseMessage]
    hcp_id: int
    extracted_entities: Dict[str, Any]
    last_tool_run: str

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

class MockLLMResponse:
    """Mock fallback parser to process medical interactions if Groq API key is missing."""
    def __init__(self, text: str, hcp_id: int = 1):
        self.text = text
        self.hcp_id = hcp_id

    def parse_interaction_notes(self) -> Dict[str, Any]:
        cleaned = self.text.lower()
        
        # 1. Detect HCP target & dynamically register if new
        from database import SessionLocal, HCP
        db = SessionLocal()
        selected_hcp_id = self.hcp_id
        hcp_name = "Dr. Sarah Jenkins"
        
        try:
            dr_match = re.search(r'dr\.?\s*([a-zA-Z]+(?:\s+[a-zA-Z])?)', self.text, re.IGNORECASE)
            if dr_match:
                candidate_name = dr_match.group(1).strip()
                full_name = "Dr. " + candidate_name.title()
                
                hcp = db.query(HCP).filter(HCP.name.like(f"%{candidate_name}%")).first()
                if not hcp:
                    hcp = HCP(
                        name=full_name,
                        specialty="General Medicine",
                        clinic_name="Community Health Clinic",
                        email=f"{candidate_name.lower().replace(' ', '')}@clinic.com",
                        phone="+1-555-0299"
                    )
                    db.add(hcp)
                    db.commit()
                    db.refresh(hcp)
                    print(f"Dynamically registered new HCP doctor: {full_name} (ID: {hcp.id})")
                selected_hcp_id = hcp.id
                hcp_name = hcp.name
            else:
                hcp = db.query(HCP).filter(HCP.id == self.hcp_id).first()
                if hcp:
                    hcp_name = hcp.name
        except Exception as e:
            print(f"Error dynamically extracting/registering doctor: {e}")
        finally:
            db.close()

        # 2. Topic/Product discussed
        topics = []
        topic_match = re.search(r'(?:discuss|talk|discussions|concerning)(?:ed)?\s+(?:about\s+|on\s+|of\s+)?([^.,\n]+)', self.text, re.IGNORECASE)
        if topic_match:
            topics.append(topic_match.group(1).strip().capitalize())
        else:
            if "lipitor" in cleaned or "atorvastatin" in cleaned:
                topics.append("Lipitor")
            if "humira" in cleaned or "adalimumab" in cleaned:
                topics.append("Humira")
            if "keytruda" in cleaned or "pembrolizumab" in cleaned:
                topics.append("Keytruda")
            if "oncoboost" in cleaned:
                topics.append("OncoBoost")
            if not topics:
                topics.append("Product Portfolio")

        # 3. Next steps / Follow-up Actions
        next_steps = "Provide medical brochures"
        steps_match = re.search(r'(?:next step|next steps|follow up|follow-up)\s+(?:is|was|to)?\s+([^.,\n]+)', self.text, re.IGNORECASE)
        if steps_match:
            next_steps = steps_match.group(1).strip().capitalize()
        else:
            if "schedule" in cleaned or "meeting" in cleaned:
                next_steps = "Schedule follow-up meeting in 2 weeks"
            elif "email" in cleaned or "send" in cleaned:
                next_steps = "Send OncoBoost Phase III PDF"
            elif "advisory" in cleaned or "board" in cleaned:
                next_steps = "Add doctor to advisory board invite list"

        # 4. Sentiment parsing
        sentiment = "Neutral"
        if any(w in cleaned for w in ["positive", "interested", "happy", "great", "excellent", "supportive"]):
            sentiment = "Positive"
        elif any(w in cleaned for w in ["negative", "frustrated", "unhappy", "skeptical", "refused", "no"]):
            sentiment = "Negative"

        # 5. Attendees parsing
        attendees = "None"
        attendees_match = re.search(r'(?:attendee|attendees|with|attended by)\s+(?:the\s+|a\s+)?(?!dr\.?)([^.,\n]+)', self.text, re.IGNORECASE)
        if attendees_match:
            attendees = attendees_match.group(1).strip().capitalize()
            attendees = re.split(r'\s+and\s+', attendees, flags=re.IGNORECASE)[0]
        else:
            if "nurse" in cleaned:
                attendees = "Nurse Assistant"
            elif "intern" in cleaned:
                attendees = "Medical Intern"
            elif "staff" in cleaned:
                attendees = "Clinic Staff"
        
        # 6. Materials Shared
        materials = "None"
        materials_match = re.search(r'(?:share|shared|gave|distribute|distributed)\s+(?:the\s+|a\s+)?([^.,\n]+)', self.text, re.IGNORECASE)
        if materials_match:
            materials = materials_match.group(1).strip().capitalize()
        else:
            if "pdf" in cleaned or "brochure" in cleaned or "literature" in cleaned:
                materials = "OncoBoost Phase III PDF"
            elif "sample" in cleaned:
                materials = "Drug starter sample packet"

        outcomes = f"Doctor expressed interest. Discussion focused on {', '.join(topics)}."

        date_match = re.search(r'\d{4}-\d{2}-\d{2}', self.text)
        date_str = date_match.group(0) if date_match else datetime_now_str()
        from datetime import datetime
        time_str = datetime.now().strftime("%H:%M")
        time_match = re.search(r'(\d{1,2}):(\d{2})\s*(am|pm)?', cleaned)
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2))
            period = time_match.group(3)
            if period:
                if period == "pm" and hour < 12:
                    hour += 12
                elif period == "am" and hour == 12:
                    hour = 0
            time_str = f"{hour:02d}:{minute:02d}"

        return {
            "hcp_id": selected_hcp_id,
            "interaction_type": "Meeting" if "meeting" in cleaned or "met" in cleaned else "Call",
            "date": date_str,
            "time": time_str,
            "attendees": attendees,
            "summary": ", ".join(topics),
            "materials_shared": materials,
            "samples_distributed": "Starter Samples" if "sample" in cleaned else "None",
            "sentiment": sentiment,
            "outcomes": outcomes,
            "next_steps": next_steps,
            "duration": 15
        }

def datetime_now_str():
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d")

# Define Agent Node
def run_agent_node(state: AgentState) -> Dict[str, Any]:
    messages = state.get("messages", [])
    hcp_id = state.get("hcp_id", 1)
    last_query = messages[-1].content if messages else ""
    
    extracted_entities = {}
    response_text = ""
    tool_triggered = "None"
    use_groq = bool(GROQ_API_KEY)
    
    if use_groq:
        try:
            llm = ChatGroq(
                model="gemma2-9b-it", 
                temperature=0.1,
                groq_api_key=GROQ_API_KEY
            )
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", """You are an AI Sales CRM Agent assistant for medical pharmaceutical representatives.
                Your task is to analyze conversational notes and interactions with Healthcare Professionals (HCPs) and trigger appropriate tools.
                
                You have access to 5 key tools:
                1. get_hcp_profile(hcp_id)
                2. log_interaction(hcp_id, summary, interaction_type, date, time, attendees, materials_shared, samples_distributed, sentiment, outcomes, next_steps, duration_mins)
                3. edit_interaction(interaction_id, summary, interaction_type, date, time, attendees, materials_shared, samples_distributed, sentiment, outcomes, next_steps)
                4. search_scientific_info(query)
                5. schedule_followup(hcp_id, activity_type, due_date)
                6. calculate_sales_metrics(hcp_id)
                
                If the user asks for performance stats, total interactions, or duration metrics, call calculate_sales_metrics.
                If they ask to update/change details already filled (e.g. 'change sentiment to negative'), call edit_interaction.
                
                Respond in friendly markdown text format. Avoid raw JSON output formats in your assistant responses.
                """),
                ("placeholder", "{messages}")
            ])
            
            tools = [get_hcp_profile, log_interaction, edit_interaction, search_scientific_info, schedule_followup, calculate_sales_metrics]
            llm_with_tools = llm.bind_tools(tools)
            chain = prompt | llm_with_tools
            
            res = chain.invoke({"messages": messages, "hcp_id": hcp_id})
            response_text = res.content
            
            if res.tool_calls:
                t_call = res.tool_calls[0]
                tool_name = t_call["name"]
                tool_args = t_call["args"]
                tool_triggered = tool_name
                
                if tool_name == "get_hcp_profile":
                    tool_res = get_hcp_profile.invoke(tool_args)
                    response_text = f"🔍 **HCP Profile details & history history retrieved successfully!**"
                elif tool_name == "log_interaction":
                    if "summary" not in tool_args:
                        tool_args["summary"] = last_query
                    tool_res = log_interaction.invoke(tool_args)
                    try:
                        extracted_entities = json.loads(tool_res)
                    except:
                        pass
                    response_text = "✅ **Interaction logged successfully!** The details (HCP Name, Date, Sentiment, and Materials) have been automatically populated based on your summary. Would you like me to suggest a specific follow-up action, such as scheduling a meeting?"
                elif tool_name == "edit_interaction":
                    tool_res = edit_interaction.invoke(tool_args)
                    try:
                        extracted_entities = json.loads(tool_res)
                    except:
                        pass
                    response_text = "✏️ **Interaction details updated!** I have modified the form fields in real-time. Please review the updated inputs."
                elif tool_name == "search_scientific_info":
                    tool_res = search_scientific_info.invoke(tool_args)
                    response_text = f"🔬 **Clinical Information Response:**\n\n{tool_res}"
                elif tool_name == "schedule_followup":
                    tool_res = schedule_followup.invoke(tool_args)
                    response_text = f"📅 **Follow-up action scheduled successfully!** I have registered a new task in your schedule."
                elif tool_name == "calculate_sales_metrics":
                    tool_res = calculate_sales_metrics.invoke(tool_args)
                    try:
                        metrics_data = json.loads(tool_res)
                        metrics = metrics_data["metrics"]
                        response_text = (
                            f"📊 **HCP Sales Performance Metrics for {metrics_data['hcp_name']}:**\n\n"
                            f"- **Total Interactions Logged**: {metrics['total_interactions_logged']}\n"
                            f"- **Total Engagement Duration**: {metrics['total_duration_minutes']} minutes\n"
                            f"- **Pending Follow-up Tasks**: {metrics['pending_followup_tasks']}\n"
                            f"- **Discussion Focus**: {metrics['discussion_focus']}"
                        )
                    except:
                        response_text = f"📊 **Sales Metrics:**\n{tool_res}"
                else:
                    tool_res = "Unknown tool execution."
                    response_text = f"Executed Tool: {tool_name}"
            
        except Exception as e:
            print(f"Error calling Groq: {e}")
            use_groq = False # Trigger fallback below
            
    # Run Fallback NLP Engine
    if not use_groq or tool_triggered == "None":
        cleaned_query = last_query.lower()
        has_field_is = any(f"{f} is" in cleaned_query or f"{f} was" in cleaned_query or f"{f} to" in cleaned_query or f"{f} should be" in cleaned_query
                           for f in ["time", "date", "dat", "day", "sentiment", "type", "name", "attendee", "summary", "topic"])
        is_correction = has_field_is or any(w in cleaned_query for w in ["change", "update", "correct", "not", "its", "instead", "should be", "set"])
        
        is_log_intent = ("met " in cleaned_query or "discuss" in cleaned_query) and not any(w in cleaned_query for w in ["change", "correct", "update", "instead", "sorry", "not dr"])
        if is_log_intent:
            is_correction = False
        
        if is_correction:
            extracted_entities = {}
        else:
            fallback = MockLLMResponse(last_query, hcp_id)
            extracted_entities = fallback.parse_interaction_notes()
        
        # A. Check change/update forms parameters intent
        if is_correction:
            tool_triggered = "edit_interaction"
            field_updated = "details"
            update_value = ""
            
            # 1. HCP Name correction
            dr_match = re.search(r'(?:its|to|is|be|not\s+.*?its)\s+dr\.?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)', last_query, re.IGNORECASE)
            if dr_match:
                candidate_name = dr_match.group(1).strip()
                full_name = "Dr. " + candidate_name.title()
                from database import SessionLocal, HCP
                db = SessionLocal()
                try:
                    hcp = db.query(HCP).filter(HCP.name.like(f"%{candidate_name}%")).first()
                    if not hcp:
                        hcp = HCP(
                            name=full_name,
                            specialty="General Medicine",
                            clinic_name="Community Health Clinic",
                            email=f"{candidate_name.lower().replace(' ', '')}@clinic.com",
                            phone="+1-555-0399"
                        )
                        db.add(hcp)
                        db.commit()
                        db.refresh(hcp)
                    extracted_entities["hcp_id"] = hcp.id
                    field_updated = "HCP Name"
                    update_value = hcp.name
                except Exception as e:
                    print(f"Error correcting doctor: {e}")
                finally:
                    db.close()

            # 2. Interaction Type correction (e.g. meeting to call)
            type_val_match = re.search(r'(?:its|to|is|be)\s+(meeting|call|email|video)', cleaned_query)
            if type_val_match:
                t = type_val_match.group(1)
                type_label = t.capitalize()
                if t == "video":
                    type_label = "Video Conference"
                extracted_entities["interaction_type"] = type_label
                field_updated = "Interaction Type"
                update_value = type_label
            elif any(t in cleaned_query for t in ["meeting", "call", "email", "video"]):
                for t in ["meeting", "call", "email", "video"]:
                    if t in cleaned_query:
                        type_label = t.capitalize()
                        if t == "video":
                            type_label = "Video Conference"
                        extracted_entities["interaction_type"] = type_label
                        field_updated = "Interaction Type"
                        update_value = type_label

            # 3. Sentiment correction
            sent_val_match = re.search(r'(?:its|to|is|be|was)\s+(positive|neutral|negative)', cleaned_query)
            if sent_val_match:
                s = sent_val_match.group(1)
                extracted_entities["sentiment"] = s.capitalize()
                field_updated = "Sentiment"
                update_value = s.capitalize()
            elif any(s in cleaned_query for s in ["positive", "neutral", "negative"]):
                for s in ["positive", "neutral", "negative"]:
                    if s in cleaned_query:
                        extracted_entities["sentiment"] = s.capitalize()
                        field_updated = "Sentiment"
                        update_value = s.capitalize()

            # 4. Date correction
            if any(d in cleaned_query for d in ["date", "dat", "day"]):
                if "today" in cleaned_query or "current date" in cleaned_query or "now" in cleaned_query:
                    from datetime import datetime
                    today_str = datetime.now().strftime("%Y-%m-%d")
                    extracted_entities["date"] = today_str
                    field_updated = "Date"
                    update_value = today_str
                else:
                    months = {
                        "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
                        "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
                        "august": 8, "aug": 8, "september": 9, "sep": 9, "october": 10, "oct": 10,
                        "november": 11, "nov": 11, "december": 12, "dec": 12
                    }
                    month_name = None
                    for m in months:
                        if m in cleaned_query:
                            month_name = m
                            break
                    if month_name:
                        month_num = months[month_name]
                        digits = [int(x) for x in re.findall(r'\d+', cleaned_query)]
                        year = 2026
                        day = 10
                        if digits:
                            year_candidate = next((x for x in digits if x >= 1000 and x <= 9999), 2026)
                            day_candidate = next((x for x in digits if x > 0 and x <= 31 and x != year_candidate), 1)
                            year = year_candidate
                            day = day_candidate
                        extracted_entities["date"] = f"{year:04d}-{month_num:02d}-{day:02d}"
                        field_updated = "Date"
                        update_value = extracted_entities["date"]
                    else:
                        date_match = re.search(r'(\d{1,4})[-/](\d{1,2})[-/](\d{1,4})', cleaned_query)
                        if date_match:
                            g1 = date_match.group(1)
                            g2 = date_match.group(2)
                            g3 = date_match.group(3)
                            if len(g1) == 4:
                                year = int(g1)
                                month = int(g2)
                                day = int(g3)
                            else:
                                year = int(g3)
                                day = int(g1)
                                month = int(g2)
                                if month > 12:
                                    day, month = month, day
                            extracted_entities["date"] = f"{year:04d}-{month:02d}-{day:02d}"
                            field_updated = "Date"
                            update_value = extracted_entities["date"]

            # 5. Time correction
            if "current time" in cleaned_query or "now" in cleaned_query or "time now" in cleaned_query:
                from datetime import datetime
                current_time_str = datetime.now().strftime("%H:%M")
                extracted_entities["time"] = current_time_str
                field_updated = "Time"
                update_value = current_time_str
            else:
                time_re = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', cleaned_query)
                if time_re and not dr_match:
                    if ":" in cleaned_query or "pm" in cleaned_query or "am" in cleaned_query or "time" in cleaned_query:
                        hour = int(time_re.group(1))
                        minute = int(time_re.group(2)) if time_re.group(2) else 0
                        period = time_re.group(3)
                        if period:
                            if period == "pm" and hour < 12:
                                hour += 12
                            elif period == "am" and hour == 12:
                                hour = 0
                        time_str = f"{hour:02d}:{minute:02d}"
                        extracted_entities["time"] = time_str
                        field_updated = "Time"
                        update_value = time_str

            # 6. Attendees correction
            if "attendee" in cleaned_query or "attended" in cleaned_query:
                att_match = re.search(r'(?:to|with)\s+([^.,\n]+)', last_query, re.IGNORECASE)
                if att_match:
                    extracted_entities["attendees"] = att_match.group(1).strip().capitalize()
                    field_updated = "Attendees"
                    update_value = extracted_entities["attendees"]

            # 7. Topics / Summary correction
            if "topic" in cleaned_query or "summary" in cleaned_query or "discuss" in cleaned_query:
                topic_match = re.search(r'(?:to|about)\s+([^.,\n]+)', last_query, re.IGNORECASE)
                if topic_match:
                    extracted_entities["summary"] = topic_match.group(1).strip().capitalize()
                    field_updated = "Topics Discussed"
                    update_value = extracted_entities["summary"]

            # 8. Outcomes correction
            if "outcome" in cleaned_query or "agreement" in cleaned_query:
                out_match = re.search(r'(?:to|about)\s+([^.,\n]+)', last_query, re.IGNORECASE)
                if out_match:
                    extracted_entities["outcomes"] = out_match.group(1).strip().capitalize()
                    field_updated = "Outcomes"
                    update_value = extracted_entities["outcomes"]

            # 9. Next steps / Follow-up Actions correction
            if "next step" in cleaned_query or "follow" in cleaned_query:
                step_match = re.search(r'(?:to|about)\s+([^.,\n]+)', last_query, re.IGNORECASE)
                if step_match:
                    extracted_entities["next_steps"] = step_match.group(1).strip().capitalize()
                    field_updated = "Follow-up Actions"
                    update_value = extracted_entities["next_steps"]
            
            response_text = f"✏️ **Interaction details updated!** I have modified the **{field_updated}** field to: *{update_value}* in your form inputs."
            
        # B. Check HCP profile lookup intent
        elif "profile" in cleaned_query or "history" in cleaned_query:
            tool_triggered = "get_hcp_profile"
            tool_res = get_hcp_profile.invoke({"hcp_id": hcp_id})
            response_text = f"🔍 **HCP Profile Details & History retrieved successfully!**\n\n```json\n{tool_res}\n```"
            
        # C. Check scientific literature search intent
        elif any(d in cleaned_query for d in ["lipit", "humir", "keytrud", "onco", "lipitor", "humira", "keytruda", "oncoboost"]):
            tool_triggered = "search_scientific_info"
            matched_drug = "efficacy"
            for d in ["lipit", "humir", "keytrud", "onco"]:
                if d in cleaned_query:
                    if d == "lipit": matched_drug = "lipitor"
                    elif d == "humir": matched_drug = "humira"
                    elif d == "keytrud": matched_drug = "keytruda"
                    elif d == "onco": matched_drug = "oncoboost"
            tool_res = search_scientific_info.invoke({"query": matched_drug})
            response_text = f"🔬 **Clinical Information Response:**\n\n{tool_res}"
        
        # D. Check Sales Metrics calculator intent
        elif any(w in cleaned_query for w in ["metric", "performance", "stat", "total", "duration", "engagement", "matrics", "matric", "sales"]):
            tool_triggered = "calculate_sales_metrics"
            tool_res = calculate_sales_metrics.invoke({"hcp_id": hcp_id})
            try:
                metrics_data = json.loads(tool_res)
                metrics = metrics_data["metrics"]
                response_text = (
                    f"📊 **HCP Sales Performance Metrics for {metrics_data['hcp_name']}:**\n\n"
                    f"- **Total Interactions Logged**: {metrics['total_interactions_logged']}\n"
                    f"- **Total Engagement Duration**: {metrics['total_duration_minutes']} minutes\n"
                    f"- **Pending Follow-up Tasks**: {metrics['pending_followup_tasks']}\n"
                    f"- **Discussion Focus**: {metrics['discussion_focus']}"
                )
            except:
                response_text = f"📊 **Sales Metrics calculated successfully!**\n{tool_res}"
                
        # E. Check scheduling follow-up task intent
        elif "schedule" in cleaned_query or "plan" in cleaned_query:
            tool_triggered = "schedule_followup"
            tool_res = schedule_followup.invoke({
                "hcp_id": hcp_id,
                "activity_type": extracted_entities["next_steps"],
                "due_date": extracted_entities["date"]
            })
            response_text = f"📅 **Follow-up action scheduled successfully!** I have registered a new task in your schedule."
            
        # F. Default: Log Interaction tool
        else:
            tool_triggered = "log_interaction"
            log_interaction.invoke({
                "hcp_id": extracted_entities["hcp_id"],
                "interaction_type": extracted_entities["interaction_type"],
                "summary": extracted_entities["summary"],
                "date": extracted_entities["date"],
                "time": extracted_entities["time"],
                "attendees": extracted_entities["attendees"],
                "materials_shared": extracted_entities["materials_shared"],
                "samples_distributed": extracted_entities["samples_distributed"],
                "sentiment": extracted_entities["sentiment"],
                "outcomes": extracted_entities["outcomes"],
                "next_steps": extracted_entities["next_steps"]
            })
            response_text = "✅ **Interaction logged successfully!** The details (HCP Name, Date, Sentiment, and Materials) have been automatically populated based on your summary. Would you like me to suggest a specific follow-up action, such as scheduling a meeting?"

    return {
        "messages": messages + [AIMessage(content=response_text)],
        "hcp_id": hcp_id,
        "extracted_entities": extracted_entities if (extracted_entities or is_correction) else {
            "hcp_id": hcp_id,
            "interaction_type": "Meeting",
            "date": datetime_now_str(),
            "time": "12:00",
            "attendees": "None",
            "summary": last_query,
            "materials_shared": "None",
            "samples_distributed": "None",
            "sentiment": "Neutral",
            "outcomes": "None",
            "next_steps": "None"
        },
        "last_tool_run": tool_triggered
    }

# Build State Graph Workflow
workflow = StateGraph(AgentState)
workflow.add_node("agent", run_agent_node)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)
agent_app = workflow.compile()

def process_agent_message(user_message: str, hcp_id: int, history: list = None) -> Dict[str, Any]:
    """Processes user chat messages through the LangGraph State Graph agent."""
    messages = []
    if history:
        for msg in history:
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg.get("content", "")))
            else:
                messages.append(AIMessage(content=msg.get("content", "")))
                
    messages.append(HumanMessage(content=user_message))
    
    initial_state = {
        "messages": messages,
        "hcp_id": hcp_id,
        "extracted_entities": {},
        "last_tool_run": ""
    }
    
    final_state = agent_app.invoke(initial_state)
    
    last_msg = final_state["messages"][-1].content if final_state["messages"] else ""
    
    return {
        "response": last_msg,
        "extracted_entities": final_state["extracted_entities"],
        "last_tool_run": final_state["last_tool_run"]
    }
