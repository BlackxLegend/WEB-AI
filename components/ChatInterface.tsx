
import React, { useState, useRef, useEffect } from 'react';
import { ChatModel, ChatMessage, ChatSession, View } from '../types';
import { chatStream, formatGeminiError, transcribeAudio } from '../services/geminiService';
import { saveSession, getSessions, deleteSession, exportUserData } from '../services/storage';
import { Send, Search, MapPin, Brain, Zap, Loader2, Bot, Paperclip, X, Download, Trash2, AlertTriangle, Check, Copy, Terminal, Mic, Radio, ExternalLink, ChevronRight, Navigation } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { GenerateContentResponse } from '@google/genai';

interface ChatInterfaceProps {
    currentUser: string;
    sessionId: string | null;
    initialMessages: ChatMessage[];
    onSessionChange: (sessionId: string) => void;
    onSessionUpdate?: () => void;
    // Optional prop to switch view
    onViewChange?: (view: View) => void;
}

// --- Custom Code Block Component ---
const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const [copied, setCopied] = useState(false);
  const codeText = String(children).replace(/\n$/, '');

  const handleCopy = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Inline Code styling
  if (inline) {
    return (
      <code 
        onClick={handleCopy}
        className="bg-gray-800/80 px-1.5 py-0.5 rounded text-sm font-mono text-blue-300 border border-gray-700/50 hover:bg-gray-700 hover:border-blue-500/50 transition-colors cursor-pointer relative group/inline"
        title="Click to copy"
        {...props}
      >
        {children}
        {copied && (
           <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none animate-in fade-in zoom-in duration-200">
             Copied!
           </span>
        )}
      </code>
    );
  }

  // Block Code styling using SyntaxHighlighter
  const language = match ? match[1] : 'text';

  return (
    <div className="not-prose my-5 rounded-xl overflow-hidden border border-gray-700/50 bg-[#0d1117] shadow-2xl group relative font-sans max-w-full">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800/40 border-b border-gray-700/50 backdrop-blur-md select-none">
         <div className="flex items-center gap-3">
            {/* Mac-style Window Controls */}
            <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
               <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] shadow-sm"></div>
               <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] shadow-sm"></div>
               <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] shadow-sm"></div>
            </div>
            <div className="h-4 w-px bg-gray-700/50 mx-1"></div>
            {/* Language Label */}
            <div className="flex items-center gap-2 text-gray-400">
                <Terminal size={13} className="text-blue-400" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-gray-400">{language}</span>
            </div>
         </div>
         {/* Copy Button */}
         <button 
           onClick={handleCopy} 
           className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all text-xs font-semibold border ${
             copied 
               ? 'bg-green-500/10 border-green-500/50 text-green-400' 
               : 'bg-gray-800 hover:bg-blue-600 hover:border-blue-500 hover:text-white border-gray-700 text-gray-300'
           }`}
         >
           {copied ? <Check size={14} /> : <Copy size={14} />}
           <span>{copied ? 'Copied!' : 'Copy Code'}</span>
         </button>
      </div>
      
      {/* Code Area */}
      <div className="overflow-x-auto bg-[#1e1e1e]">
         <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            customStyle={{
                margin: 0,
                padding: '1.5rem',
                backgroundColor: 'transparent',
                fontSize: '0.9rem',
                lineHeight: '1.5',
            }}
            wrapLines={true}
            showLineNumbers={true}
            lineNumberStyle={{ minWidth: '2.5em', paddingRight: '1em', color: '#6e7681', textAlign: 'right' }}
         >
            {codeText}
         </SyntaxHighlighter>
      </div>
    </div>
  );
};

// --- Custom Map Card Component ---
const MapCard = ({ locations }: { locations: { uri: string, title: string }[] }) => {
  if (!locations || locations.length === 0) return null;

  return (
    <div className="not-prose my-6 w-full max-w-md bg-[#0d1117] rounded-xl overflow-hidden border border-gray-800 shadow-2xl font-sans group/card select-none">
      {/* Header / Pseudo-Map View */}
      <div className="relative h-28 bg-gray-800 w-full overflow-hidden">
        {/* Grid Pattern to simulate map */}
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent"></div>
        
        {/* Animated Radar/Ping Effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-green-500/5 rounded-full blur-2xl animate-pulse"></div>
        
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between z-10">
             <div className="flex items-center gap-2">
                 <div className="bg-[#1f2937] p-1.5 rounded-lg border border-gray-700 shadow-sm">
                    <MapPin size={16} className="text-green-400" />
                 </div>
                 <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">Grounding</span>
                    <span className="text-[10px] text-gray-500 font-medium">Google Maps Data</span>
                 </div>
             </div>
        </div>
      </div>
      
      {/* Interactive List */}
      <div className="p-2 space-y-1 bg-[#0d1117]">
         {locations.map((loc, i) => (
            <a 
              key={i} 
              href={loc.uri} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800/50 transition-all border border-transparent hover:border-gray-700 group/item relative overflow-hidden"
            >
               {/* Pin Index */}
               <div className="relative z-10 w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex flex-shrink-0 items-center justify-center text-xs font-bold text-gray-500 group-hover/item:border-green-500 group-hover/item:text-green-400 transition-colors shadow-sm">
                  {String.fromCharCode(65 + i)}
               </div>
               
               <div className="flex-1 min-w-0 z-10">
                  <h4 className="text-sm font-medium text-gray-300 group-hover/item:text-white truncate transition-colors">
                      {loc.title}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-gray-500 group-hover/item:text-green-400 transition-colors">Open in Maps</span>
                      <ExternalLink size={10} className="text-gray-600 group-hover/item:text-green-400 opacity-0 group-hover/item:opacity-100 transition-all" />
                  </div>
               </div>
               
               {/* Arrow */}
               <div className="z-10 text-gray-700 group-hover/item:text-gray-400 group-hover/item:translate-x-0.5 transition-all">
                   <ChevronRight size={16} />
               </div>

               {/* Hover Highlight */}
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-800/20 to-transparent translate-x-[-100%] group-hover/item:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>
            </a>
         ))}
      </div>
      
      {/* Footer */}
      <div className="bg-gray-900/50 px-4 py-2 border-t border-gray-800 flex items-center justify-between text-[10px] text-gray-600">
          <span>{locations.length} results found</span>
          <span className="flex items-center gap-1"><Navigation size={10} /> GPS Enabled</span>
      </div>
    </div>
  );
};


export const ChatInterface: React.FC<ChatInterfaceProps> = ({ currentUser, sessionId, initialMessages, onSessionChange, onSessionUpdate, onViewChange }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState<ChatModel>(ChatModel.SMART);
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{data: string, mimeType: string} | null>(null);
  
  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const prevSessionIdRef = useRef<string | null>(sessionId);

  // Sync with initialMessages when session changes
  useEffect(() => {
    // Determine if the session ID has actually changed
    const hasSessionChanged = sessionId !== prevSessionIdRef.current;
    
    if (hasSessionChanged) {
        // Switching to a completely new chat session
        setMessages(initialMessages);
        setInput('');
        setSelectedImage(null);
        setTimeout(() => textInputRef.current?.focus(), 100);
        prevSessionIdRef.current = sessionId;
    } else if (messages.length === 0 && initialMessages.length > 0) {
        // Hydrate from storage on first load if local is empty
        setMessages(initialMessages);
    }
  }, [initialMessages, sessionId, messages.length]);

  // Save session whenever messages update
  useEffect(() => {
    if (currentUser && sessionId && messages.length > 0) {
        const title = messages[0]?.text.slice(0, 30) + (messages[0]?.text.length > 30 ? '...' : '') || 'New Chat';
        saveSession(currentUser, {
            id: sessionId,
            title,
            messages,
            updatedAt: Date.now()
        });
        onSessionUpdate?.();
    }
  }, [messages, sessionId, currentUser, onSessionUpdate]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom(isLoading ? "instant" : "smooth");
  }, [messages, isLoading]);

  const handleExport = () => {
      exportUserData(currentUser);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setSelectedImage({ data: base64Data, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDictation = async () => {
    if (isRecording) {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const chunks: BlobPart[] = [];
            
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                stream.getTracks().forEach(t => t.stop());
                
                setIsTranscribing(true);
                try {
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                        const b64 = (reader.result as string).split(',')[1];
                        const res = await transcribeAudio(b64, 'audio/webm');
                        if (res.text) {
                            setInput(prev => prev + (prev ? ' ' : '') + res.text);
                        }
                        setIsTranscribing(false);
                    };
                    reader.readAsDataURL(blob);
                } catch (e) {
                    console.error("Transcription failed", e);
                    setIsTranscribing(false);
                }
            };
            
            mediaRecorder.start();
            mediaRecorderRef.current = mediaRecorder;
            setIsRecording(true);
        } catch (e) {
            console.error("Mic error", e);
            alert("Could not access microphone.");
        }
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMsg: ChatMessage = { 
        id: Date.now().toString(), 
        role: 'user', 
        text: input,
        image: selectedImage ? `data:${selectedImage.mimeType};base64,${selectedImage.data}` : undefined,
        timestamp: Date.now()
    };

    let currentSessionId = sessionId;

    if (!currentSessionId) {
        currentSessionId = Date.now().toString();
        setMessages([userMsg]);
        const title = userMsg.text.slice(0, 30) + (userMsg.text.length > 30 ? '...' : '') || 'New Chat';
        saveSession(currentUser, {
            id: currentSessionId,
            title,
            messages: [userMsg],
            updatedAt: Date.now()
        });
        
        onSessionUpdate?.(); 
        onSessionChange(currentSessionId); 
    } else {
        setMessages(prev => [...prev, userMsg]);
    }

    setInput('');
    const currentImage = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    // Prepare location if maps used
    let loc = undefined;
    if (useMaps && navigator.geolocation) {
      try {
        const pos: GeolocationPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        };
      } catch (e) {
        console.error("Loc error", e);
      }
    }

    const startTime = Date.now();

    try {
      const currentHistory = sessionId ? [...messages, userMsg] : [userMsg];
      
      const history = currentHistory
        .filter(m => m.text && m.text.trim().length > 0)
        .map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));

      const apiHistory = history.slice(0, -1);
      
      // Determine model
      const isGrounding = useMaps || useSearch;
      // Force Flash for grounding to avoid 400 errors, otherwise respect Thinking/Model selection
      const selectedModel = isGrounding ? ChatModel.FAST : (useThinking ? 'gemini-3-pro-preview' : model);
      const effectiveThinking = useThinking && !isGrounding;

      const stream = await chatStream(
        selectedModel,
        apiHistory,
        userMsg.text,
        {
          search: useSearch,
          maps: useMaps,
          thinking: effectiveThinking,
          latLng: loc
        },
        currentImage || undefined
      );

      let botMsgId = (Date.now() + 1).toString();
      let botText = '';
      let groundingData: any = {};
      let firstChunkReceived = false;
      let thoughtDuration = 0;

      setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: '', isThinking: effectiveThinking, timestamp: Date.now() }]);

      for await (const chunk of stream) {
        if (!firstChunkReceived) {
            firstChunkReceived = true;
            thoughtDuration = (Date.now() - startTime) / 1000;
        }

        const c = chunk as GenerateContentResponse;
        
        // Handle text
        if (c.text) {
           botText += c.text;
        }

        // Handle grounding
        const chunks = c.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
            const searchLinks = chunks.filter((ch: any) => ch.web).map((ch: any) => ch.web);
            const mapLinks = chunks.filter((ch: any) => ch.maps).map((ch: any) => ch.maps);
            
            if (searchLinks.length > 0) groundingData.search = searchLinks;
            if (mapLinks.length > 0) groundingData.maps = mapLinks;
        }

        setMessages(prev => prev.map(m => 
        m.id === botMsgId 
            ? { ...m, text: botText, grounding: groundingData, isThinking: false, thoughtDuration: effectiveThinking ? thoughtDuration : undefined } 
            : m
        ));
      }

    } catch (error: any) {
      console.error(error);
      let errorText = formatGeminiError(error);

      // Specific handling for Maps Grounding errors to provide actionable advice
      if (useMaps) {
          const rawMsg = (error.message || '').toLowerCase();
          if (rawMsg.includes('enabled') || rawMsg.includes('not supported') || errorText.includes('400')) {
              errorText = "Google Maps Grounding Unavailable: This feature requires the 'Gemini 2.5 Flash' model (auto-selected) and a valid API Key with Google Maps permissions. Please check your API key configuration.";
          } else if (errorText.includes("403")) {
              errorText = "Permission Denied: Your API Key may not have Google Maps Grounding enabled. Please check your Google Cloud Console.";
          }
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: errorText, timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textInputRef.current?.focus(), 100);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex flex-wrap items-center justify-between gap-4 min-h-[72px]">
        <div></div>

        <div id="chat-header-tools" className="flex items-center space-x-3">
             {/* Live Voice Shortcut */}
             {onViewChange && (
                 <button
                    onClick={() => onViewChange(View.AUDIO)}
                    className="hidden md:flex items-center space-x-1.5 text-xs font-semibold text-red-400 bg-red-900/10 hover:bg-red-900/30 px-3 py-1.5 rounded-full border border-red-900/30 mr-2 transition-colors"
                 >
                     <Radio size={14} className="animate-pulse" />
                     <span>Start Live Voice</span>
                 </button>
             )}

            <div className="flex items-center space-x-2 mr-2 border-r border-gray-700 pr-4">
                <button 
                    id="chat-export-btn"
                    onClick={handleExport}
                    className="text-gray-400 hover:text-blue-400 p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    title="Export Chat History (JSON)"
                >
                    <Download size={18} />
                </button>
            </div>

            {model === ChatModel.SMART && (
                <button 
                    onClick={() => { setUseThinking(!useThinking); setUseMaps(false); setUseSearch(false); }}
                    className={`p-2 rounded-full transition-all border ${useThinking ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'}`}
                    title="Deep Thinking Mode"
                >
                    <Brain size={18} className={useThinking ? "animate-pulse" : ""} />
                </button>
            )}
            <div className="h-6 w-px bg-gray-700 mx-1"></div>
            <button 
                onClick={() => { setUseSearch(!useSearch); setUseMaps(false); setUseThinking(false); }}
                className={`p-2 rounded-full transition-all border ${useSearch ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'}`}
                title="Google Search Grounding"
            >
                <Search size={18} />
            </button>
            <button 
                onClick={() => { setUseMaps(!useMaps); setUseSearch(false); setUseThinking(false); }}
                className={`p-2 rounded-full transition-all border ${useMaps ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'}`}
                title="Google Maps Grounding"
            >
                <MapPin size={18} />
            </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
             <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-2">
                <Bot size={32} className="text-blue-500" />
             </div>
             <p className="text-lg font-medium text-gray-400">OmniAI Studio</p>
             <div className="flex flex-wrap gap-2 text-sm opacity-60 justify-center">
                <span>Gemini 3 Pro</span>
                <span>•</span>
                <span>Thinking</span>
                <span>•</span>
                <span>Vision</span>
             </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] lg:max-w-[75%] space-y-2`}>
              <div className={`p-4 rounded-2xl shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-gray-800/80 text-gray-100 rounded-bl-none border border-gray-700/50 backdrop-blur-sm'
              }`}>
                 {msg.image && (
                     <img src={msg.image} alt="Generated Content" className="rounded-lg mb-3 max-w-full max-h-[400px] object-cover border border-white/20 bg-black/50" />
                 )}
                 {msg.isThinking && (
                    <div className="flex items-center space-x-2 text-indigo-300 mb-2 text-sm italic">
                        <Loader2 className="animate-spin" size={14} />
                        <span>Thinking deeply...</span>
                    </div>
                 )}
                 
                 {msg.thoughtDuration && !msg.isThinking && (
                     <div className="mb-2">
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-indigo-400 bg-indigo-950/50 border border-indigo-800/50 px-2 py-1 rounded-md">
                            <Brain size={10} /> Thought for {msg.thoughtDuration.toFixed(1)}s
                        </span>
                     </div>
                 )}

                 {(msg.text.includes("400") || msg.text.includes("403") || msg.text.includes("404") || msg.text.includes("429") || msg.text.includes("500") || msg.text.includes("Network")) ? (
                     <div className="flex items-center gap-2 text-red-300 bg-red-900/20 p-2 rounded">
                         <AlertTriangle size={20} className="flex-shrink-0" />
                         <span className="text-sm font-medium">{msg.text}</span>
                     </div>
                 ) : (
                    <div className="prose prose-invert prose-sm max-w-none break-words">
                        <ReactMarkdown 
                            components={{
                                a: ({node, ...props}) => <a {...props} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" />,
                                pre: ({children}) => <>{children}</>,
                                code: CodeBlock,
                                p: ({children}) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                                ul: ({children}) => <ul className="list-disc list-outside ml-4 mb-4 space-y-1">{children}</ul>,
                                ol: ({children}) => <ol className="list-decimal list-outside ml-4 mb-4 space-y-1">{children}</ol>,
                                li: ({children}) => <li className="text-gray-300 pl-1">{children}</li>,
                                h1: ({children}) => <h1 className="text-2xl font-bold mb-4 mt-6 text-white border-b border-gray-700 pb-2">{children}</h1>,
                                h2: ({children}) => <h2 className="text-xl font-bold mb-3 mt-5 text-white">{children}</h2>,
                                h3: ({children}) => <h3 className="text-lg font-bold mb-2 mt-4 text-white">{children}</h3>,
                                blockquote: ({children}) => <blockquote className="border-l-4 border-blue-500 pl-4 py-1 my-4 italic text-gray-400 bg-gray-800/30 rounded-r-lg">{children}</blockquote>,
                                table: ({children}) => <div className="overflow-x-auto my-4 rounded-lg border border-gray-700"><table className="min-w-full divide-y divide-gray-700 text-sm">{children}</table></div>,
                                thead: ({children}) => <thead className="bg-gray-800">{children}</thead>,
                                tbody: ({children}) => <tbody className="divide-y divide-gray-700 bg-gray-900/50">{children}</tbody>,
                                tr: ({children}) => <tr>{children}</tr>,
                                th: ({children}) => <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{children}</th>,
                                td: ({children}) => <td className="px-3 py-2 whitespace-nowrap text-gray-300">{children}</td>,
                            }}
                        >
                            {msg.text}
                        </ReactMarkdown>
                    </div>
                 )}
              </div>

              {/* Grounding Sources */}
              {msg.grounding && (
                  <div className="flex flex-col gap-2 mt-2 max-w-[85%]">
                      {/* Search Results as Tags */}
                      {msg.grounding.search && msg.grounding.search.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-1">
                              {msg.grounding.search.map((s, i) => (
                                  <a key={i} href={s.uri} target="_blank" rel="noreferrer" 
                                     className="flex items-center gap-1 text-xs bg-gray-900 border border-gray-700 text-gray-400 px-2 py-1 rounded hover:text-white hover:border-gray-500 transition-colors">
                                      <Search size={10} /> {s.title}
                                  </a>
                              ))}
                          </div>
                      )}
                      
                      {/* Maps Results as Rich Cards */}
                      {msg.grounding.maps && msg.grounding.maps.length > 0 && (
                          <MapCard locations={msg.grounding.maps} />
                      )}
                  </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && !messages[messages.length - 1]?.isThinking && messages[messages.length - 1]?.role !== 'model' && (
           <div className="flex justify-start">
              <div className="flex items-center space-x-2 text-gray-500 bg-gray-900/50 px-4 py-2 rounded-full border border-gray-800/50">
                  <Loader2 size={16} className="animate-spin text-blue-500" />
                  <span className="text-sm">Generating response...</span>
              </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div id="chat-input-area" className="p-3 lg:p-4 bg-gray-900 border-t border-gray-800">
        <div className="max-w-4xl mx-auto space-y-2">
          {selectedImage && (
             <div className="flex items-center gap-2 bg-gray-800 w-fit px-3 py-2 rounded-lg border border-gray-700">
                 <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} alt="Preview" className="h-10 w-10 object-cover rounded" />
                 <span className="text-xs text-gray-300">Image attached</span>
                 <button onClick={() => setSelectedImage(null)} className="text-gray-400 hover:text-red-400">
                     <X size={16} />
                 </button>
             </div>
          )}
          <div className="relative">
            <input 
               type="file" 
               ref={fileInputRef} 
               onChange={handleImageSelect} 
               accept="image/*" 
               className="hidden" 
            />
            <button 
               onClick={() => fileInputRef.current?.click()}
               className="absolute left-2 top-2 bottom-2 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
               title="Upload Image (Analysis)"
            >
               <Paperclip size={20} />
            </button>
            <input
              type="text"
              ref={textInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={selectedImage ? "Add a message about this image..." : isRecording ? "Listening..." : "Ask anything..."}
              className={`w-full bg-gray-950 border text-white rounded-xl pl-12 pr-20 lg:pr-24 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-inner transition-all ${isRecording ? 'border-red-500 ring-2 ring-red-500/20 placeholder-red-400' : 'border-gray-700 placeholder-gray-600'}`}
              disabled={isLoading || isTranscribing}
            />
            
            <div className="absolute right-2 top-2 bottom-2 flex items-center space-x-1">
                <button
                    onClick={handleDictation}
                    disabled={isLoading}
                    className={`p-2 rounded-lg transition-all ${isRecording ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    title="Dictate Message"
                >
                    {isTranscribing ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
                </button>

                <button 
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && !selectedImage)}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 flex items-center justify-center transition-all disabled:opacity-50 disabled:hover:bg-blue-600"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-gray-600 mt-2">
           Gemini 3 Pro Preview & Flash Lite. Data may be inaccurate.
        </p>
      </div>
    </div>
  );
};
