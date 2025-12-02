
import React, { useState } from 'react';
import { View, ChatSession } from '../types';
import { MessageSquare, Mic, LogOut, User as UserIcon, Plus, Trash2, MessageCircle, X, Search, AlertTriangle } from 'lucide-react';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onLogout: () => void;
  username: string;
  sessions?: ChatSession[];
  currentSessionId?: string | null;
  onNewChat?: () => void;
  onSelectSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  
  // Mobile props
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onViewChange, 
  onLogout, 
  username,
  sessions = [],
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  isOpen = false,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const menuItems = [
    { view: View.CHAT, label: 'Chat & Think', icon: MessageSquare },
    { view: View.AUDIO, label: 'Realtime Voice', icon: Mic },
  ];

  const handleMobileNav = (view: View) => {
    onViewChange(view);
    onClose?.();
  };

  const handleMobileNewChat = () => {
    onNewChat?.();
    onClose?.();
  }

  const filteredSessions = sessions.filter(s => 
    !searchQuery || (s.title && s.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl shadow-2xl max-w-xs w-full">
              <div className="flex flex-col items-center text-center space-y-3">
                 <div className="p-3 bg-red-900/20 rounded-full text-red-400">
                     <AlertTriangle size={24} />
                 </div>
                 <h3 className="text-lg font-bold text-white">Delete Chat?</h3>
                 <p className="text-sm text-gray-400">
                    Are you sure you want to delete this chat? This action cannot be undone.
                 </p>
                 <div className="flex gap-3 w-full mt-2">
                    <button 
                       onClick={() => setDeleteConfirmId(null)}
                       className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                       Cancel
                    </button>
                    <button 
                       onClick={() => { onDeleteSession?.(deleteConfirmId); setDeleteConfirmId(null); }}
                       className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors font-medium"
                    >
                       Delete
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed lg:relative inset-y-0 left-0 z-40 w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full shadow-2xl lg:shadow-none transition-transform duration-300 ease-in-out transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-4 lg:px-6 mb-2 flex items-center justify-between lg:justify-start h-16 lg:h-20 border-b border-gray-800 lg:border-none">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-lg shadow-lg flex-shrink-0"></div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              OmniAI
            </h1>
          </div>
          {/* Mobile Close Button */}
          <button 
            onClick={onClose}
            className="lg:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Main Nav */}
        <div id="sidebar-nav" className="flex-none px-3 space-y-1 mb-6 mt-4 lg:mt-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => handleMobileNav(item.view)}
                className={`w-full p-3 lg:px-4 flex items-center space-x-3 rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-white" : "group-hover:text-blue-400 transition-colors"} />
                <span className={`font-medium ${isActive ? 'text-white' : ''}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Chat Specific Section: New Chat & History */}
        {currentView === View.CHAT && (
          <div className="flex-1 flex flex-col min-h-0 px-3 border-t border-gray-800 pt-4">
             {/* New Chat Button */}
             <button 
               id="sidebar-new-chat"
               onClick={handleMobileNewChat}
               className="w-full mb-4 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 border border-gray-700/50 hover:border-blue-500/30 rounded-xl p-3 flex items-center justify-start space-x-3 transition-all group shadow-sm"
             >
                <div className="bg-blue-500/10 p-1.5 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                    <Plus size={18} />
                </div>
                <span className="font-semibold">New Chat</span>
             </button>

             <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Chats</span>
             </div>

             {/* Search Bar */}
             <div className="relative mb-3 px-1">
                 <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />
                 <input 
                    id="sidebar-search-input"
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search history..."
                    className="w-full bg-gray-900 border border-gray-800 focus:border-blue-500/50 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none transition-all placeholder-gray-600"
                 />
             </div>

             {/* History List */}
             <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2 space-y-1 custom-scrollbar pb-4">
                {filteredSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-gray-600 mt-10 text-center px-4">
                        <MessageCircle size={32} className="mb-2 opacity-20" />
                        <p className="text-sm">{searchQuery ? 'No matches found' : 'No recent chats'}</p>
                    </div>
                ) : (
                    filteredSessions.map(session => {
                        // Fuzzy-ish Highlight Logic
                        let titleNode: React.ReactNode = session.title || 'Untitled Chat';
                        if (searchQuery && session.title) {
                             const parts = session.title.split(new RegExp(`(${searchQuery})`, 'gi'));
                             titleNode = parts.map((part, i) => 
                                part.toLowerCase() === searchQuery.toLowerCase() 
                                ? <span key={i} className="text-blue-400 font-bold bg-blue-900/30 rounded px-0.5">{part}</span> 
                                : part
                             );
                        }

                        return (
                        <div 
                          key={session.id} 
                          className={`group relative flex items-center rounded-lg transition-colors
                            ${currentSessionId === session.id 
                               ? 'bg-gray-800 text-gray-200' 
                               : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
                            }`}
                        >
                            <button
                              onClick={() => { onSelectSession?.(session.id); onClose?.(); }}
                              className="flex-1 flex items-center space-x-3 p-3 text-left overflow-hidden"
                            >
                               <MessageSquare size={16} className={`flex-shrink-0 ${currentSessionId === session.id ? 'text-blue-400' : 'text-gray-600'}`} />
                               <span className="truncate text-sm">
                                   {titleNode}
                               </span>
                            </button>
                            
                            {/* Delete Action */}
                            <button
                               onClick={(e) => {
                                   e.stopPropagation();
                                   setDeleteConfirmId(session.id);
                               }}
                               className="flex opacity-100 lg:opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-red-400 transition-opacity absolute right-1"
                               title="Delete Chat"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )})
                )}
             </div>
          </div>
        )}
        
        {/* Spacer if not in Chat view to push User section down */}
        {currentView !== View.CHAT && <div className="flex-1" />}

        {/* User Section */}
        <div className="px-3 py-4 border-t border-gray-800 w-full mt-auto bg-gray-900 z-10">
           <div className="flex items-center space-x-3 mb-2 px-3 py-3 rounded-xl bg-gray-800/50 border border-gray-800">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-blue-300 shadow-inner">
                 <UserIcon size={18} />
              </div>
              <div className="overflow-hidden flex-1">
                 <p className="text-sm font-semibold text-gray-200 truncate">{username}</p>
                 <div className="flex items-center gap-1 mt-1">
                     <span className="w-2 h-2 rounded-full bg-green-500"></span>
                     <span className="text-[10px] text-gray-500 font-medium">Online</span>
                 </div>
              </div>
           </div>

           <button 
             onClick={onLogout}
             className="w-full p-3 flex items-center justify-start px-4 space-x-3 text-gray-400 hover:text-red-400 hover:bg-red-900/10 rounded-xl transition-all"
             title="Logout"
           >
              <LogOut size={20} />
              <span className="font-medium">Sign Out</span>
           </button>
        </div>
      </aside>
    </>
  );
};
