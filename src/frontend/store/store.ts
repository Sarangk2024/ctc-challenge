import { configureStore, createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';

export interface HCPProfile {
  id: number;
  name: string;
  specialty: string;
  clinic_name: string;
  email: string;
  phone: string;
  address?: string;
}

export interface InteractionItem {
  id: number;
  hcp_id: number;
  hcp_name: string;
  interaction_type: string;
  date: string;
  time: string;
  attendees: string;
  summary: string;
  materials_shared: string;
  samples_distributed: string;
  sentiment: string;
  outcomes: string;
  next_steps: string;
  duration_mins: number;
}

export interface TaskItem {
  id: number;
  hcp_id: number;
  hcp_name: string;
  due_date: string;
  activity_type: string;
  status: string;
}

export interface MessageItem {
  role: 'user' | 'assistant';
  content: string;
  lastToolRun?: string;
}

const initialFormState = {
  hcp_id: 1,
  interaction_type: 'Meeting',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().split(' ')[0].substring(0, 5),
  attendees: '',
  summary: '',
  materials_shared: '',
  samples_distributed: '',
  sentiment: 'Neutral',
  outcomes: '',
  next_steps: '',
  duration_mins: 15
};

interface CRMState {
  hcps: {
    list: HCPProfile[];
    activeHcpId: number | null;
    loading: boolean;
    error: string | null;
  };
  interactions: {
    list: InteractionItem[];
    activeLogId: number | null;
    formState: typeof initialFormState;
    loading: boolean;
  };
  chat: {
    messages: MessageItem[];
    loading: boolean;
  };
  tasks: {
    list: TaskItem[];
    loading: boolean;
  };
}

const initialState: CRMState = {
  hcps: {
    list: [],
    activeHcpId: 1,
    loading: false,
    error: null
  },
  interactions: {
    list: [],
    activeLogId: null,
    formState: initialFormState,
    loading: false
  },
  chat: {
    messages: [
      { role: 'assistant', content: "Hello! I am your AI Sales Assistant. Tell me about your interaction with the doctor (e.g. 'Met with Dr. Sarah Jenkins today, sentiment was positive, shared keytruda brochure, next steps schedule followup in 2 weeks') and I will parse it to sync your log fields." }
    ],
    loading: false
  },
  tasks: {
    list: [],
    loading: false
  }
};

// Async Thunks
export const fetchHCPs = createAsyncThunk('crm/fetchHCPs', async () => {
  const res = await fetch('http://127.0.0.1:8000/api/hcps');
  if (!res.ok) throw new Error('Failed to fetch HCPs');
  return (await res.json()) as HCPProfile[];
});

export const fetchInteractions = createAsyncThunk('crm/fetchInteractions', async (hcpId?: number) => {
  const url = hcpId 
    ? `http://127.0.0.1:8000/api/interactions?hcp_id=${hcpId}` 
    : 'http://127.0.0.1:8000/api/interactions';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch interactions');
  return (await res.json()) as InteractionItem[];
});

export const fetchTasks = createAsyncThunk('crm/fetchTasks', async (hcpId?: number) => {
  const url = hcpId 
    ? `http://127.0.0.1:8000/api/tasks?hcp_id=${hcpId}` 
    : 'http://127.0.0.1:8000/api/tasks';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return (await res.json()) as TaskItem[];
});

export const postInteraction = createAsyncThunk('crm/postInteraction', async (data: typeof initialFormState) => {
  const res = await fetch('http://127.0.0.1:8000/api/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save interaction');
  return await res.json();
});

export const updateInteraction = createAsyncThunk('crm/updateInteraction', async ({ id, data }: { id: number, data: Partial<typeof initialFormState> }) => {
  const res = await fetch(`http://127.0.0.1:8000/api/interactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update interaction');
  return await res.json();
});

export const sendMessageToAgent = createAsyncThunk('crm/sendMessageToAgent', async (
  { message, hcpId, history }: { message: string, hcpId: number, history: MessageItem[] }
) => {
  const formattedHistory = history.map(m => ({
    role: m.role,
    content: m.content
  }));

  const res = await fetch('http://127.0.0.1:8000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, hcp_id: hcpId, history: formattedHistory })
  });
  if (!res.ok) throw new Error('Agent failed to process message');
  return await res.json() as { 
    response: string; 
    extracted_entities: {
      hcp_id?: number;
      interaction_type?: string;
      date?: string;
      time?: string;
      attendees?: string;
      summary?: string;
      materials_shared?: string;
      samples_distributed?: string;
      sentiment?: string;
      outcomes?: string;
      next_steps?: string;
      duration?: number;
    }; 
    last_tool_run: string; 
  };
});

const crmSlice = createSlice({
  name: 'crm',
  initialState,
  reducers: {
    setActiveHcp(state, action: PayloadAction<number>) {
      state.hcps.activeHcpId = action.payload;
      state.interactions.formState.hcp_id = action.payload;
    },
    updateFormState(state, action: PayloadAction<Partial<typeof initialFormState>>) {
      state.interactions.formState = {
        ...state.interactions.formState,
        ...action.payload
      };
    },
    resetFormState(state) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      const yyyy = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${month}-${dd}`;

      state.interactions.formState = {
        ...initialFormState,
        date: dateStr,
        time: timeStr,
        hcp_id: state.hcps.activeHcpId || 1
      };
      state.interactions.activeLogId = null;
    },
    setActiveLogId(state, action: PayloadAction<number | null>) {
      state.interactions.activeLogId = action.payload;
      if (action.payload) {
        const selected = state.interactions.list.find(i => i.id === action.payload);
        if (selected) {
          state.interactions.formState = {
            hcp_id: selected.hcp_id,
            interaction_type: selected.interaction_type,
            date: selected.date,
            time: selected.time,
            attendees: selected.attendees,
            summary: selected.summary,
            materials_shared: selected.materials_shared,
            samples_distributed: selected.samples_distributed,
            sentiment: selected.sentiment,
            outcomes: selected.outcomes,
            next_steps: selected.next_steps,
            duration_mins: selected.duration_mins
          };
        }
      } else {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const timeStr = `${hh}:${mm}`;
        const yyyy = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${month}-${dd}`;

        state.interactions.formState = {
          ...initialFormState,
          date: dateStr,
          time: timeStr,
          hcp_id: state.hcps.activeHcpId || 1
        };
      }
    },
    addHumanChatMessage(state, action: PayloadAction<string>) {
      state.chat.messages.push({ role: 'user', content: action.payload });
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch HCPs
      .addCase(fetchHCPs.pending, (state) => {
        state.hcps.loading = true;
      })
      .addCase(fetchHCPs.fulfilled, (state, action) => {
        state.hcps.loading = false;
        state.hcps.list = action.payload;
        if (action.payload.length > 0 && !state.hcps.activeHcpId) {
          state.hcps.activeHcpId = action.payload[0].id;
          state.interactions.formState.hcp_id = action.payload[0].id;
        }
      })
      .addCase(fetchHCPs.rejected, (state, action) => {
        state.hcps.loading = false;
        state.hcps.error = action.error.message || 'Error loading doctors';
      })
      
      // Fetch Interactions
      .addCase(fetchInteractions.fulfilled, (state, action) => {
        state.interactions.list = action.payload;
      })
      
      // Fetch Tasks
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.tasks.list = action.payload;
      })

      // Send message to Agent
      .addCase(sendMessageToAgent.pending, (state) => {
        state.chat.loading = true;
      })
      .addCase(sendMessageToAgent.fulfilled, (state, action) => {
        state.chat.loading = false;
        state.chat.messages.push({
          role: 'assistant',
          content: action.payload.response,
          lastToolRun: action.payload.last_tool_run
        });
        
        if (action.payload.extracted_entities && Object.keys(action.payload.extracted_entities).length > 0) {
          const entities = action.payload.extracted_entities;
          state.interactions.formState = {
            hcp_id: entities.hcp_id || state.interactions.formState.hcp_id,
            interaction_type: entities.interaction_type || state.interactions.formState.interaction_type,
            date: entities.date || state.interactions.formState.date,
            time: entities.time || state.interactions.formState.time,
            attendees: entities.attendees || state.interactions.formState.attendees,
            summary: entities.summary || state.interactions.formState.summary,
            materials_shared: entities.materials_shared || state.interactions.formState.materials_shared,
            samples_distributed: entities.samples_distributed || state.interactions.formState.samples_distributed,
            sentiment: entities.sentiment || state.interactions.formState.sentiment,
            outcomes: entities.outcomes || state.interactions.formState.outcomes,
            next_steps: entities.next_steps || state.interactions.formState.next_steps,
            duration_mins: entities.duration || state.interactions.formState.duration_mins
          };
        }
      })
      .addCase(sendMessageToAgent.rejected, (state) => {
        state.chat.loading = false;
        state.chat.messages.push({
          role: 'assistant',
          content: 'I apologize, but I encountered an error communicating with the agent service. Please make sure the backend is active.'
        });
      });
  }
});

export const {
  setActiveHcp,
  updateFormState,
  resetFormState,
  setActiveLogId,
  addHumanChatMessage
} = crmSlice.actions;

export const store = configureStore({
  reducer: {
    crm: crmSlice.reducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
