
import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { AudioSuite } from './components/AudioSuite';
import { LoginPage } from './components/LoginPage';
import { View, ChatSession } from './types';
import { getSessions, deleteSession } from './services/storage';
import { TourOverlay, TourStep } from './components/TourOverlay';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.CHAT);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showTour, setShowTour] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load user
  useEffect(() => {
    const storedUser = localStorage.getItem('omniai_current_user');
    if (storedUser) {
        setCurrentUser(storedUser);
    }
  }, []);

  // Tour logic check
  useEffect(() => {
    if (currentUser) {
        // Check if tour is already done for this user
        const tourDone = localStorage.getItem(`omniai_tour_done_${currentUser}`);
        if (!tourDone) {
            // Slight delay to ensure DOM is ready
            setTimeout(() => setShowTour(true), 800);
        }
    }
  }, [currentUser]);

  // Load sessions when user or view changes
  const refreshSessions = useCallback(() => {
      if (currentUser) {
          setSessions(getSessions(currentUser));
      }
  }, [currentUser]);

  useEffect(() => {
      refreshSessions();
  }, [currentUser, refreshSessions]);

  const handleLogin = (username: string) => {
    localStorage.setItem('omniai_current_user', username);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem('omniai_current_user');
    setCurrentUser(null);
    setCurrentView(View.CHAT);
    setCurrentSessionId(null);
    setSessions([]);
    setIsSidebarOpen(false);
  };

  const handleNewChat = useCallback(() => {
      setCurrentSessionId(null);
      setCurrentView(View.CHAT);
      setIsSidebarOpen(false);
  }, []);

  const handleDeleteSession = (sid: string) => {
      if (currentUser) {
          deleteSession(currentUser, sid);
          if (currentSessionId === sid) {
              setCurrentSessionId(null);
          }
          refreshSessions();
      }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!currentUser) return;

        // Shortcut: New Chat (N) - only if not typing
        if (
            e.key.toLowerCase() === 'n' && 
            !e.ctrlKey && !e.altKey && !e.metaKey &&
            !(e.target instanceof HTMLInputElement) && 
            !(e.target instanceof HTMLTextAreaElement)
        ) {
            e.preventDefault();
            handleNewChat();
        }

        // Shortcut: Focus Search (Ctrl + S)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            const searchInput = document.getElementById('sidebar-search-input');
            if (searchInput) {
                if (!isSidebarOpen) setIsSidebarOpen(true);
                searchInput.focus();
            }
        }

        // Shortcut: Toggle Sidebar (Ctrl + Shift + D)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            setIsSidebarOpen(prev => !prev);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser, handleNewChat, isSidebarOpen]);

  const handleTourComplete = () => {
    setShowTour(false);
    if (currentUser) {
        localStorage.setItem(`omniai_tour_done_${currentUser}`, 'true');
    }
  };

  const getInitialMessages = (sid: string | null) => {
    if (!sid || !currentUser) return [];
    const session = sessions.find(s => s.id === sid);
    return session ? session.messages : [];
  };

  const renderView = () => {
    switch (currentView) {
      case View.CHAT:
        return <ChatInterface 
                  currentUser={currentUser!} 
                  sessionId={currentSessionId}
                  initialMessages={getInitialMessages(currentSessionId)}
                  onSessionChange={setCurrentSessionId}
                  onSessionUpdate={refreshSessions}
                  onViewChange={setCurrentView}
               />;
      case View.AUDIO:
        return <AudioSuite />;
      default:
        return <ChatInterface 
                  currentUser={currentUser!} 
                  sessionId={currentSessionId}
                  initialMessages={getInitialMessages(currentSessionId)}
                  onSessionChange={setCurrentSessionId}
                  onSessionUpdate={refreshSessions}
                  onViewChange={setCurrentView}
               />;
    }
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const tourSteps: TourStep[] = [
      {
          title: "Welcome to OmniAI Studio!",
          content: "Your all-in-one AI workspace for chatting, deep reasoning, and voice interaction. Let's show you around.",
          position: 'center'
      },
      {
          targetId: 'sidebar-nav',
          title: 'Navigation',
          content: 'Switch between the main Chat interface and the Realtime Voice suite here.',
          position: 'right'
      },
      {
          targetId: 'sidebar-new-chat',
          title: 'New Chat',
          content: 'Start a fresh conversation anytime. Your recent history is saved just below.',
          position: 'right'
      },
      {
          targetId: 'chat-header-tools',
          title: 'Smart Tools',
          content: 'Toggle "Deep Thinking" for complex problems, or use Google Search & Maps grounding for real-world data.',
          position: 'bottom'
      },
      {
          targetId: 'chat-input-area',
          title: 'Your Input',
          content: 'Type your message, dictate with your voice, or upload images for analysis here.',
          position: 'top'
      }
  ];

  return (
    <div className="flex w-full h-full bg-gray-950 text-white font-sans overflow-hidden">
      
      {/* Sidebar (Desktop & Mobile Drawer) */}
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        onLogout={handleLogout}
        username={currentUser}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectSession={setCurrentSessionId}
        onDeleteSession={handleDeleteSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
        
        {/* Mobile Header */}
        <header className="lg:hidden h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 justify-between flex-shrink-0 z-20">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            >
                <Menu size={24} />
            </button>
            <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                OmniAI
            </span>
            <div className="w-8"></div> {/* Spacer for balance */}
        </header>

        <main className="flex-1 h-full overflow-hidden relative flex flex-col bg-gray-950 w-full">
            {renderView()}
        </main>
      </div>

      <TourOverlay 
          steps={tourSteps}
          isOpen={showTour}
          onComplete={handleTourComplete}
          onSkip={handleTourComplete}
      />
    </div>
  );
};

export default App;
