'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchHCPs,
  fetchInteractions,
  fetchTasks,
  postInteraction,
  updateInteraction,
  sendMessageToAgent,
  setActiveHcp,
  updateFormState,
  resetFormState,
  setActiveLogId,
  addHumanChatMessage,
  RootState,
  AppDispatch
} from '../store/store';
import {
  User,
  Calendar,
  Clock,
  Mic,
  Volume2,
  Search,
  Gift,
  Smile,
  Meh,
  Frown,
  Send,
  MessageSquare,
  FileText,
  Wrench,
  Activity,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  FileSearch,
  CheckCircle,
  Edit2
} from 'lucide-react';

export default function LogInteractionScreen() {
  const dispatch = useDispatch<AppDispatch>();

  // Redux Slices
  const { hcps, interactions, chat, tasks } = useSelector((state: RootState) => state.crm);
  const activeHcp = hcps.list.find(h => h.id === hcps.activeHcpId);

  // Local Chat / UI state
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'tasks'>('timeline');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize Data
  useEffect(() => {
    dispatch(fetchHCPs());
  }, [dispatch]);

  useEffect(() => {
    if (hcps.activeHcpId) {
      dispatch(fetchInteractions(hcps.activeHcpId));
      dispatch(fetchTasks(hcps.activeHcpId));
    }
  }, [hcps.activeHcpId, dispatch]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages]);

  // Voice Note Simulation
  const handleVoiceNoteSimulate = () => {
    const mockTranscripts = [
      "Met Dr. Sarah Jenkins today at 3 PM. We discussed Lipitor safety and oncology trial updates. She was positive and requested OncoBoost Phase III trial sheets. Nurse Assistant attended too.",
      "Call with Dr. James Patel. Discussed Keytruda efficacy. He had neutral sentiment, requested follow-up next week.",
      "Meeting with Dr. Emily Vance regarding pediatric dosage schedules. She expressed interest in our new clinic brochures."
    ];
    // Pick random transcript or matching current doctor
    let text = mockTranscripts[0];
    if (hcps.activeHcpId === 2) text = mockTranscripts[1];
    if (hcps.activeHcpId === 3) text = mockTranscripts[2];

    alert(`Simulating voice note transcription:\n"${text}"`);

    dispatch(addHumanChatMessage(text));
    dispatch(sendMessageToAgent({
      message: text,
      hcpId: hcps.activeHcpId || 1,
      history: chat.messages
    })).then((actionResult) => {
      dispatch(fetchHCPs()).then(() => {
        if (actionResult.payload && typeof actionResult.payload === 'object') {
          const payload = actionResult.payload as any;
          if (payload.extracted_entities && payload.extracted_entities.hcp_id) {
            const newId = payload.extracted_entities.hcp_id;
            dispatch(setActiveHcp(newId));
            dispatch(fetchInteractions(newId));
            dispatch(fetchTasks(newId));
            return;
          }
        }
        if (hcps.activeHcpId) {
          dispatch(fetchInteractions(hcps.activeHcpId));
          dispatch(fetchTasks(hcps.activeHcpId));
        }
      });
    });
  };

  // Add mock materials / samples
  const handleAddMaterial = () => {
    const doc = prompt("Enter Material name to share:", "OncoBoost Phase III PDF");
    if (doc) {
      const current = interactions.formState.materials_shared;
      const updated = current ? `${current}, ${doc}` : doc;
      dispatch(updateFormState({ materials_shared: updated }));
    }
  };

  const handleAddSample = () => {
    const sample = prompt("Enter Sample name to distribute:", "Keytruda Starter Packet");
    if (sample) {
      const current = interactions.formState.samples_distributed;
      const updated = current ? `${current}, ${sample}` : sample;
      dispatch(updateFormState({ samples_distributed: updated }));
    }
  };

  // Chat agent pipeline
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !hcps.activeHcpId) return;

    const query = chatInput;
    dispatch(addHumanChatMessage(query));
    setChatInput('');

    dispatch(sendMessageToAgent({
      message: query,
      hcpId: hcps.activeHcpId,
      history: chat.messages
    })).then((actionResult) => {
      dispatch(fetchHCPs()).then(() => {
        if (actionResult.payload && typeof actionResult.payload === 'object') {
          const payload = actionResult.payload as any;
          if (payload.extracted_entities && payload.extracted_entities.hcp_id) {
            const newId = payload.extracted_entities.hcp_id;
            dispatch(setActiveHcp(newId));
            dispatch(fetchInteractions(newId));
            dispatch(fetchTasks(newId));
            return;
          }
        }
        dispatch(fetchInteractions(hcps.activeHcpId!));
        dispatch(fetchTasks(hcps.activeHcpId!));
      });
    });
  };

  // Structured Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!interactions.formState.summary.trim()) {
      alert("Please enter topics discussed.");
      return;
    }

    if (interactions.activeLogId) {
      dispatch(updateInteraction({
        id: interactions.activeLogId,
        data: interactions.formState
      })).then(() => {
        dispatch(fetchInteractions(hcps.activeHcpId!));
        dispatch(fetchTasks(hcps.activeHcpId!));
        alert("Interaction details updated successfully.");
      });
    } else {
      dispatch(postInteraction(interactions.formState)).then(() => {
        dispatch(fetchInteractions(hcps.activeHcpId!));
        dispatch(fetchTasks(hcps.activeHcpId!));
        alert("Interaction logged successfully.");
      });
    }
  };

  const handleEditClick = (logId: number) => {
    dispatch(setActiveLogId(logId));
  };

  const handleDoctorChange = (id: number) => {
    dispatch(setActiveHcp(id));
    dispatch(resetFormState());
  };

  const handleToggleTask = async (taskId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Pending' ? 'Completed' : 'Pending';
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        dispatch(fetchTasks(hcps.activeHcpId!));
      }
    } catch (e) {
      console.error("Error updating task status:", e);
    }
  };

  return (
    <div className="crm-layout">
      {/* LEFT SIDEBAR: Doctor directory */}
      <aside className="sidebar" style={{ background: '#090e1c', borderRight: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <Activity style={{ color: '#0284c7', width: 26, height: 26 }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.3px' }}>Pulse CRM Agent</h2>
        </div>

        {/* Selected Doctor details */}
        {activeHcp && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              padding: 16,
              marginBottom: 24,
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 800
                }}
              >
                {activeHcp.name.split(' ').pop()?.charAt(0)}
              </div>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{activeHcp.name}</h4>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{activeHcp.specialty}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: '#94a3b8' }}>
              <div>🏢 {activeHcp.clinic_name}</div>
              <div>📞 {activeHcp.phone}</div>
              <div>✉️ {activeHcp.email}</div>
            </div>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px' }}>
            HCP Directory
          </h3>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hcps.list.map((hcp) => {
              const isSelected = hcp.id === hcps.activeHcpId;
              return (
                <div
                  key={hcp.id}
                  onClick={() => handleDoctorChange(hcp.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
                    color: isSelected ? '#38bdf8' : '#94a3b8',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12.5 }}>{hcp.name}</div>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{hcp.specialty}</span>
                  </div>
                  <ChevronRight style={{ width: 14, opacity: isSelected ? 1 : 0.3 }} />
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* CORE WORKSPACE CONTENT */}
      <main className="main-content" style={{ background: '#f8fafc', padding: '24px 32px' }}>
        
        {/* Top title */}
        <header style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Log HCP Interaction</h1>
          </div>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#e0f2fe',
            color: '#0284c7',
            fontSize: 12,
            padding: '4px 12px',
            borderRadius: 20,
            fontWeight: 700
          }}>
            <TrendingUp style={{ width: 13 }} /> LangGraph AI Graph Active
          </span>
        </header>

        {/* Dual UI split screen layout columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 24, alignItems: 'start', marginBottom: 28 }}>
          
          {/* COLUMN 1: Structured Log Details */}
          <section
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 18
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
              Interaction Details
            </h2>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Row 1: HCP & Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>HCP Name</label>
                  <select
                    value={interactions.formState.hcp_id}
                    onChange={(e) => handleDoctorChange(Number(e.target.value))}
                    style={{ height: 42, padding: '4px 12px', borderColor: '#cbd5e1', borderRadius: '6px', fontSize: 13, color: '#0f172a', background: '#ffffff', lineHeight: 'normal' }}
                  >
                    {hcps.list.map(hcp => (
                      <option key={hcp.id} value={hcp.id}>{hcp.name} ({hcp.specialty})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>Interaction Type</label>
                  <select
                    value={interactions.formState.interaction_type}
                    onChange={(e) => dispatch(updateFormState({ interaction_type: e.target.value }))}
                    style={{ height: 42, padding: '4px 12px', borderColor: '#cbd5e1', borderRadius: '6px', fontSize: 13, color: '#0f172a', background: '#ffffff', lineHeight: 'normal' }}
                  >
                    <option value="Meeting">Meeting</option>
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="Video Conference">Video Conference</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Date & Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>Date</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="date"
                      value={interactions.formState.date}
                      onChange={(e) => dispatch(updateFormState({ date: e.target.value }))}
                      style={{ height: 42, paddingLeft: 40, borderColor: '#cbd5e1', borderRadius: '6px', fontSize: 13, color: '#0f172a', background: '#ffffff', width: '100%' }}
                    />
                    <Calendar style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>Time</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="time"
                      value={interactions.formState.time}
                      onChange={(e) => dispatch(updateFormState({ time: e.target.value }))}
                      style={{ height: 42, paddingLeft: 40, borderColor: '#cbd5e1', borderRadius: '6px', fontSize: 13, color: '#0f172a', background: '#ffffff', width: '100%' }}
                    />
                    <Clock style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Row 3: Attendees */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>Attendees</label>
                <input
                  type="text"
                  value={interactions.formState.attendees}
                  onChange={(e) => dispatch(updateFormState({ attendees: e.target.value }))}
                  placeholder="Enter names or search..."
                  style={{ height: 38, borderColor: '#cbd5e1' }}
                />
              </div>

              {/* Row 4: Topics Discussed with microphone icon */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>Topics Discussed *</label>
                <div style={{ position: 'relative' }}>
                  <textarea
                    value={interactions.formState.summary}
                    onChange={(e) => dispatch(updateFormState({ summary: e.target.value }))}
                    placeholder="Enter key discussion points..."
                    style={{ height: 80, paddingRight: 40, resize: 'none', borderColor: '#cbd5e1' }}
                    required
                  />
                  <Mic style={{ position: 'absolute', right: 12, bottom: 12, width: 18, color: '#94a3b8', cursor: 'pointer' }} onClick={handleVoiceNoteSimulate} />
                </div>
              </div>

              {/* Summarize from Voice Note CTA button */}
              <button
                type="button"
                onClick={handleVoiceNoteSimulate}
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Volume2 style={{ width: 14 }} /> Summarize from Voice Note (Requires Consent)
              </button>

              {/* Materials Shared & Samples Distributed grids */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                {/* Materials Shared */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: 12, background: '#fafbfc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Materials Shared</span>
                    <button
                      type="button"
                      onClick={handleAddMaterial}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '3px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Search style={{ width: 10 }} /> Search/Add
                    </button>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>
                    {interactions.formState.materials_shared || "No materials added."}
                  </div>
                </div>

                {/* Samples Distributed */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: 12, background: '#fafbfc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Samples Distributed</span>
                    <button
                      type="button"
                      onClick={handleAddSample}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '3px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Gift style={{ width: 10 }} /> Add Sample
                    </button>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>
                    {interactions.formState.samples_distributed || "No samples added."}
                  </div>
                </div>
              </div>

              {/* Observed/Inferred HCP Sentiment */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', marginBottom: 10 }}>
                  Observed/Inferred HCP Sentiment
                </label>
                <div style={{ display: 'flex', gap: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="sentiment"
                      value="Positive"
                      checked={interactions.formState.sentiment === 'Positive'}
                      onChange={() => dispatch(updateFormState({ sentiment: 'Positive' }))}
                      style={{ width: 16, height: 16 }}
                    />
                    <Smile style={{ width: 16, color: '#10b981' }} /> Positive
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="sentiment"
                      value="Neutral"
                      checked={interactions.formState.sentiment === 'Neutral'}
                      onChange={() => dispatch(updateFormState({ sentiment: 'Neutral' }))}
                      style={{ width: 16, height: 16 }}
                    />
                    <Meh style={{ width: 16, color: '#f59e0b' }} /> Neutral
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="sentiment"
                      value="Negative"
                      checked={interactions.formState.sentiment === 'Negative'}
                      onChange={() => dispatch(updateFormState({ sentiment: 'Negative' }))}
                      style={{ width: 16, height: 16 }}
                    />
                    <Frown style={{ width: 16, color: '#ef4444' }} /> Negative
                  </label>
                </div>
              </div>

              {/* Outcomes */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>Outcomes</label>
                <textarea
                  value={interactions.formState.outcomes}
                  onChange={(e) => dispatch(updateFormState({ outcomes: e.target.value }))}
                  placeholder="Key outcomes or agreements..."
                  style={{ height: 60, resize: 'none', borderColor: '#cbd5e1' }}
                />
              </div>

              {/* Follow-up Actions */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>Follow-up Actions</label>
                <textarea
                  value={interactions.formState.next_steps}
                  onChange={(e) => dispatch(updateFormState({ next_steps: e.target.value }))}
                  placeholder="Enter next steps or tasks..."
                  style={{ height: 60, resize: 'none', borderColor: '#cbd5e1' }}
                />
              </div>

              {/* AI Suggested Follow-ups */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  AI Suggested Follow-ups:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => dispatch(updateFormState({ next_steps: "Schedule follow-up meeting in 2 weeks" }))}
                    style={{ background: 'none', border: 'none', textAlign: 'left', color: '#0284c7', fontSize: 12, fontWeight: 600 }}
                  >
                    + Schedule follow-up meeting in 2 weeks
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch(updateFormState({ next_steps: "Send OncoBoost Phase III PDF" }))}
                    style={{ background: 'none', border: 'none', textAlign: 'left', color: '#0284c7', fontSize: 12, fontWeight: 600 }}
                  >
                    + Send OncoBoost Phase III PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch(updateFormState({ next_steps: "Add Dr. Sharma to advisory board invite list" }))}
                    style={{ background: 'none', border: 'none', textAlign: 'left', color: '#0284c7', fontSize: 12, fontWeight: 600 }}
                  >
                    + Add Dr. Sharma to advisory board invite list
                  </button>
                </div>
              </div>

              {/* Save log action button */}
              <div style={{ display: 'flex', gap: 12, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    height: 42,
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: 13.5
                  }}
                >
                  {interactions.activeLogId ? "Save Changes (Update Interaction)" : "Submit Interaction Log"}
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(resetFormState())}
                  style={{
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '0 20px',
                    borderRadius: '8px',
                    fontWeight: 700
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>

          {/* COLUMN 2: Conversational AI Assistant */}
          <section
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              height: 720,
              position: 'sticky',
              top: 24
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare style={{ color: '#0284c7', width: 18 }} />
                <span style={{ fontWeight: 800, fontSize: 14.5, color: '#1e293b' }}>AI Assistant</span>
              </div>
              <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 2 }}>Log interaction via chat</span>
            </div>

            {/* Chat top welcome card */}
            <div style={{ padding: 16 }}>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: 12,
                  fontSize: 12,
                  color: '#475569',
                  lineHeight: 1.5
                }}
              >
                Log interaction details here (e.g., "Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure") or ask for help.
              </div>
            </div>

            {/* Conversation Log bubbles */}
            <div style={{ flex: 1, padding: '0 20px 20px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {chat.messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={idx}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        backgroundColor: isUser ? '#f1f5f9' : '#e0f2fe',
                        color: isUser ? '#0f172a' : '#0369a1',
                        fontSize: 12.5,
                        fontWeight: 500,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {msg.content.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} style={{ fontWeight: 800 }}>{part}</strong> : part)}
                    </div>
                    {!isUser && msg.lastToolRun && msg.lastToolRun !== 'None' && (
                      <span
                        style={{
                          fontSize: 9,
                          color: '#10b981',
                          background: '#d1fae5',
                          padding: '1px 6px',
                          borderRadius: 6,
                          fontWeight: 700,
                          marginTop: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3
                        }}
                      >
                        <Wrench style={{ width: 8 }} /> Agent Tool: {msg.lastToolRun}
                      </span>
                    )}
                  </div>
                );
              })}
              {chat.loading && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 11.5 }}>
                  <div className="dot-loading">Agent processing notes...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Bottom input form */}
            <form
              onSubmit={handleChatSubmit}
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                gap: 8,
                background: '#fafbfc'
              }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Describe interaction..."
                disabled={chat.loading}
                style={{ flex: 1, height: 38, borderRadius: '4px', borderColor: '#cbd5e1', fontSize: 13 }}
              />
              <button
                type="submit"
                disabled={chat.loading || !chatInput.trim()}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '0 18px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                Log
              </button>
            </form>
          </section>
        </div>

        {/* BOTTOM HISTORICAL FEEDBACK & TIMELINE */}
        <section
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
            <button
              onClick={() => setActiveTab('timeline')}
              style={{
                padding: '10px 16px',
                fontWeight: 700,
                fontSize: 13,
                color: activeTab === 'timeline' ? '#0284c7' : '#64748b',
                borderBottom: activeTab === 'timeline' ? '3px solid #0284c7' : '3px solid transparent',
                background: 'none'
              }}
            >
              🕒 Interaction History Timeline
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              style={{
                padding: '10px 16px',
                fontWeight: 700,
                fontSize: 13,
                color: activeTab === 'tasks' ? '#0284c7' : '#64748b',
                borderBottom: activeTab === 'tasks' ? '3px solid #0284c7' : '3px solid transparent',
                background: 'none'
              }}
            >
              📅 Scheduled Tasks ({tasks.list.filter(t => t.status === 'Pending').length})
            </button>
          </div>

          {/* Timeline Feed */}
          {activeTab === 'timeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {interactions.list.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: 13 }}>
                  No logged interactions for this physician. Use the chat or form above to log one!
                </div>
              ) : (
                interactions.list.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start'
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          backgroundColor: '#e0f2fe',
                          color: '#0284c7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <FileText style={{ width: 16 }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1e293b' }}>{log.hcp_name}</span>
                          <span style={{ fontSize: 11, color: '#64748b', background: '#e2e8f0', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                            {log.interaction_type}
                          </span>
                          <span style={{ fontSize: 11, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Calendar style={{ width: 11 }} /> {log.date} at {log.time}
                          </span>
                          <span style={{ fontSize: 11, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Clock style={{ width: 11 }} /> {log.duration_mins}m
                          </span>
                        </div>
                        
                        <p style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.4, marginBottom: 8 }}>
                          {log.summary}
                        </p>

                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {log.sentiment && (
                            <span style={{ fontSize: 10, background: log.sentiment === 'Positive' ? '#d1fae5' : log.sentiment === 'Negative' ? '#fee2e2' : '#fef3c7', padding: '2px 8px', borderRadius: 10, color: log.sentiment === 'Positive' ? '#065f46' : log.sentiment === 'Negative' ? '#991b1b' : '#d97706', fontWeight: 700 }}>
                              Sentiment: {log.sentiment}
                            </span>
                          )}
                          {log.attendees && log.attendees !== 'None' && (
                            <span style={{ fontSize: 10, background: '#f1f5f9', padding: '2px 8px', borderRadius: 10, color: '#475569', fontWeight: 600 }}>
                              Attendees: {log.attendees}
                            </span>
                          )}
                          {log.materials_shared && log.materials_shared !== 'None' && (
                            <span style={{ fontSize: 10, background: '#e0f2fe', padding: '2px 8px', borderRadius: 10, color: '#0369a1', fontWeight: 600 }}>
                              Shared: {log.materials_shared}
                            </span>
                          )}
                          {log.next_steps && (
                            <span style={{ fontSize: 10, background: '#d1fae5', padding: '2px 8px', borderRadius: 10, color: '#065f46', fontWeight: 700 }}>
                              Action: {log.next_steps}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleEditClick(log.id)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                      title="Edit Log"
                    >
                      <Edit2 style={{ width: 12 }} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tasks List */}
          {activeTab === 'tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tasks.list.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: 13 }}>
                  No scheduled follow-ups found.
                </div>
              ) : (
                tasks.list.map((task) => {
                  const isCompleted = task.status === 'Completed';
                  return (
                    <div
                      key={task.id}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() => handleToggleTask(task.id, task.status)}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: isCompleted ? '#94a3b8' : '#1e293b',
                            textDecoration: isCompleted ? 'line-through' : 'none'
                          }}>
                            {task.activity_type}
                          </div>
                          <span style={{ fontSize: 11, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                            <Calendar style={{ width: 10 }} /> Due Date: {task.due_date}
                          </span>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 12,
                          backgroundColor: isCompleted ? '#d1fae5' : '#fef3c7',
                          color: isCompleted ? '#065f46' : '#d97706'
                        }}
                      >
                        {task.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
