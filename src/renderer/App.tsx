import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import ChatRoomPage from './pages/ChatRoom';
import AgentsPage from './pages/Agents';
import TeamsPage from './pages/Teams';
import SkillsPage from './pages/Skills';
import MemoriesPage from './pages/Memories';
import WorkspacePage from './pages/Workspace';
import SettingsPage from './pages/Settings';
import KanbanPage from './pages/Kanban';
import { useAppStore } from './stores/app';
import { useAgentsStore } from './stores/agents';
import { useLLMStore } from './stores/llm';
import { useChatRoomsStore } from './stores/chatrooms';
import { useSkillsStore } from './stores/skills';
import { useKanbanStore } from './stores/kanban';

const App: React.FC = () => {
  const loadSystemInfo = useAppStore((s) => s.loadSystemInfo);
  const loadLocalhostUrl = useAppStore((s) => s.loadLocalhostUrl);
  const loadSettings = useAppStore((s) => s.loadSettings);

  const loadAgents = useAgentsStore((s) => s.loadAgents);
  const loadTeams = useAgentsStore((s) => s.loadTeams);
  const loadProviders = useLLMStore((s) => s.loadProviders);
  const loadPresets = useLLMStore((s) => s.loadPresets);
  const loadChatrooms = useChatRoomsStore((s) => s.loadChatrooms);
  const loadSkills = useSkillsStore((s) => s.loadSkills);
  const loadKanbanBoards = useKanbanStore((s) => s.loadBoards);

  useEffect(() => {
    void loadSystemInfo();
    void loadLocalhostUrl();
    void loadSettings();
    void loadSkills();
    void loadProviders();
    void loadPresets();
    void loadAgents();
    void loadTeams();
    void loadChatrooms();
    void loadKanbanBoards();
  }, [
    loadSystemInfo,
    loadLocalhostUrl,
    loadSettings,
    loadSkills,
    loadProviders,
    loadPresets,
    loadAgents,
    loadTeams,
    loadChatrooms,
    loadKanbanBoards,
  ]);

  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<ChatRoomPage />} />
          <Route path="/chat/:chatRoomId" element={<ChatRoomPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/kanban/:boardId" element={<KanbanPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/memories" element={<MemoriesPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
  );
};

export default App;