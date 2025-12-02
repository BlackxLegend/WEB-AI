
import React, { useState, useRef, useEffect } from 'react';
import { generateSpeech, transcribeAudioStream, translateAudio, formatGeminiError, getEffectiveApiKey } from '../services/geminiService';
import { Mic, Volume2, Radio, Activity, StopCircle, Play, AlertTriangle, Settings, Pause, Upload, FileAudio, Keyboard, Languages, Check, Globe, ChevronDown, X, Info, Loader2 } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob, GenerateContentResponse } from '@google/genai';

// --- HELPER FUNCTIONS FOR AUDIO ---

function createBlob(data: Float32Array): GenAIBlob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    const uint8 = new Uint8Array(int16.buffer);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
    }
    const b64 = btoa(binary);
    
    return {
      data: b64,
      mimeType: 'audio/pcm;rate=16000',
    };
}
  
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// --- CONSTANTS ---

const SUPPORTED_LANGUAGES = [
  "Afrikaans", "Albanian", "Amharic", "Arabic", "Armenian", "Azerbaijani", "Basque", "Belarusian", "Bengali", 
  "Bosnian", "Bulgarian", "Catalan", "Cebuano", "Chichewa", "Chinese (Simplified)", "Chinese (Traditional)", 
  "Corsican", "Croatian", "Czech", "Danish", "Dutch", "English", "Esperanto", "Estonian", "Filipino", "Finnish", 
  "French", "Frisian", "Galician", "Georgian", "German", "Greek", "Gujarati", "Haitian Creole", "Hausa", 
  "Hawaiian", "Hebrew", "Hindi", "Hmong", "Hungarian", "Icelandic", "Igbo", "Indonesian", "Irish", "Italian", 
  "Japanese", "Javanese", "Kannada", "Kazakh", "Khmer", "Kinyarwanda", "Korean", "Kurdish (Kurmanji)", 
  "Kyrgyz", "Lao", "Latin", "Latvian", "Lithuanian", "Luxembourgish", "Macedonian", "Malagasy", "Malay", 
  "Malayalam", "Maltese", "Maori", "Marathi", "Mongolian", "Myanmar (Burmese)", "Nepali", "Norwegian", 
  "Odia (Oriya)", "Pashto", "Persian", "Polish", "Portuguese", "Punjabi", "Romanian", "Russian", "Samoan", 
  "Scots Gaelic", "Serbian", "Sesotho", "Shona", "Sindhi", "Sinhala", "Slovak", "Slovenian", "Somali", 
  "Spanish", "Sundanese", "Swahili", "Swedish", "Tajik", "Tamil", "Tatar", "Telugu", "Thai", "Turkish", 
  "Turkmen", "Ukrainian", "Urdu", "Uyghur", "Uzbek", "Vietnamese", "Welsh", "Xhosa", "Yiddish", "Yoruba", "Zulu"
];

// --- CONFIG INTERFACES ---
interface AudioSettings {
    inputSampleRate: number;
    outputSampleRate: number;
    bufferSize: number;
}

type TranslatorStatus = 'IDLE' | 'RECORDING' | 'PROCESSING' | 'TRANSLATING' | 'SPEAKING';

// --- COMPONENT ---

export const AudioSuite: React.FC = () => {
    const [tab, setTab] = useState<'LIVE' | 'TTS' | 'TRANSLATOR' | 'LIVE_TRANSCRIBE'>('LIVE');
    const [liveActive, setLiveActive] = useState(false);
    
    // Settings
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<AudioSettings>({
        inputSampleRate: 16000,
        outputSampleRate: 24000,
        bufferSize: 4096
    });

    // TTS
    const [ttsText, setTtsText] = useState('');
    const [selectedVoice, setSelectedVoice] = useState('Puck');
    const [isTtsProcessing, setIsTtsProcessing] = useState(false);

    // Transcription / Translation
    const [error, setError] = useState<string | null>(null);

    // LIVE API REFS
    const liveClientRef = useRef<GoogleGenAI | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const inputContextRef = useRef<AudioContext | null>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    
    // Visualizer Refs
    const inputAnalyserRef = useRef<AnalyserNode | null>(null);
    const outputAnalyserRef = useRef<AnalyserNode | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const volumeBarRef = useRef<HTMLDivElement>(null);
    const speechIndicatorRef = useRef<HTMLDivElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    
    // Live UI State
    const [isOutputPaused, setIsOutputPaused] = useState(false);
    const [connectionState, setConnectionState] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('DISCONNECTED');

    // Translator
    const [translatorFile, setTranslatorFile] = useState<{data: string, mimeType: string} | null>(null);
    const [targetLang, setTargetLang] = useState('English');
    const [translationResult, setTranslationResult] = useState('');
    const [translatorStatus, setTranslatorStatus] = useState<TranslatorStatus>('IDLE');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [isRecording, setIsRecording] = useState(false);

    // Live Transcribe (Dictation)
    const [liveDictationText, setLiveDictationText] = useState('');
    const [isDictationProcessing, setIsDictationProcessing] = useState(false);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopLiveSession();
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    // --- VISUALIZER ---
    useEffect(() => {
        if (tab === 'LIVE' && liveActive && canvasRef.current) {
            const canvas = canvasRef.current;
            // Handle resizing canvas to match container
            const container = canvasContainerRef.current;
            if (container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const draw = () => {
                const width = canvas.width;
                const height = canvas.height;
                ctx.clearRect(0, 0, width, height);

                // Helper to get frequency data
                const getFreqData = (analyser: AnalyserNode | null) => {
                    if (!analyser) return new Uint8Array(0);
                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);
                    analyser.getByteFrequencyData(dataArray);
                    return dataArray;
                };

                const inputFreqs = getFreqData(inputAnalyserRef.current);
                const outputFreqs = getFreqData(outputAnalyserRef.current);

                // Volume Meter Logic
                let sum = 0;
                for(let i=0; i < inputFreqs.length; i++) sum += inputFreqs[i];
                const avg = sum / inputFreqs.length;
                
                if (volumeBarRef.current) {
                    // Amplify signal for better visual feedback
                    const height = Math.min(100, (avg / 255) * 400); 
                    volumeBarRef.current.style.height = `${height}%`;
                }

                if (speechIndicatorRef.current) {
                    if (avg > 15) {
                        speechIndicatorRef.current.style.opacity = '1';
                        speechIndicatorRef.current.classList.add('animate-pulse');
                        speechIndicatorRef.current.style.boxShadow = '0 0 15px rgba(34, 197, 94, 0.4)';
                    } else {
                        speechIndicatorRef.current.style.opacity = '0.2';
                        speechIndicatorRef.current.classList.remove('animate-pulse');
                        speechIndicatorRef.current.style.boxShadow = 'none';
                    }
                }

                // Draw Output (Model) from Center Up
                const barWidth = width < 400 ? 3 : 4;
                const gap = 2;
                const barCount = Math.floor(width / (barWidth + gap));
                
                if (outputAnalyserRef.current) {
                    let x = (width - barCount * (barWidth + gap)) / 2;
                    for (let i = 0; i < barCount; i++) {
                         const index = Math.floor((i / barCount) * (outputFreqs.length / 2));
                         const value = outputFreqs[index];
                         const percent = value / 255;
                         const barHeight = Math.max(2, percent * (height / 2.5));

                         ctx.fillStyle = `rgba(59, 130, 246, ${Math.max(0.3, percent)})`; // Blue
                         // Mirrored Top
                         ctx.fillRect(x, (height / 2) - barHeight - 2, barWidth, barHeight);
                         // Mirrored Bottom
                         ctx.fillRect(x, (height / 2) + 2, barWidth, barHeight);
                         x += barWidth + gap;
                    }
                }

                // Draw Input (User) Circular Visual
                if (inputAnalyserRef.current) {
                    if (avg > 5) {
                         ctx.beginPath();
                         ctx.arc(width/2, height/2, 20 + avg, 0, 2 * Math.PI);
                         ctx.strokeStyle = `rgba(34, 197, 94, ${Math.min(0.8, avg/100)})`; // Green
                         ctx.lineWidth = 2;
                         ctx.stroke();
                         
                         ctx.beginPath();
                         ctx.arc(width/2, height/2, 10 + avg/2, 0, 2 * Math.PI);
                         ctx.fillStyle = `rgba(34, 197, 94, ${Math.min(0.2, avg/200)})`;
                         ctx.fill();
                    }
                }

                animationFrameRef.current = requestAnimationFrame(draw);
            };
            draw();
        } else {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }
    }, [tab, liveActive]);


    // --- SETTINGS HANDLERS ---
    const handleSettingChange = (key: keyof AudioSettings, value: number) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // --- LIVE API LOGIC ---
    const startLiveSession = async () => {
        setError(null);
        setIsOutputPaused(false);
        setConnectionState('CONNECTING');
        
        try {
            const apiKey = getEffectiveApiKey();
            const ai = new GoogleGenAI({ apiKey });
            liveClientRef.current = ai;

            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: settings.inputSampleRate });
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: settings.outputSampleRate });
            inputContextRef.current = inputCtx;
            audioContextRef.current = outputCtx;
            
            // Analysers
            const inputAnalyser = inputCtx.createAnalyser();
            inputAnalyser.fftSize = 256;
            inputAnalyserRef.current = inputAnalyser;

            const outputAnalyser = outputCtx.createAnalyser();
            outputAnalyser.fftSize = 256;
            outputAnalyserRef.current = outputAnalyser;
            
            const outputNode = outputCtx.createGain();
            outputNode.connect(outputAnalyser);
            outputAnalyser.connect(outputCtx.destination);

            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (e: any) {
                setConnectionState('ERROR');
                if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                    throw new Error("Microphone access denied. Please allow microphone permissions in your browser settings.");
                } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
                    throw new Error("No microphone found. Please check your audio input device.");
                } else {
                    throw new Error("Could not access audio device. Please check your system settings.");
                }
            }
            mediaStreamRef.current = stream;

            // Connect Live
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        console.log("Live Session Open");
                        setLiveActive(true);
                        setConnectionState('CONNECTED');
                        
                        const source = inputCtx.createMediaStreamSource(stream);
                        source.connect(inputAnalyser);

                        // Using user configured buffer size
                        const processor = inputCtx.createScriptProcessor(settings.bufferSize, 1, 1);
                        scriptProcessorRef.current = processor;
                        
                        processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };

                        source.connect(processor);
                        processor.connect(inputCtx.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        const b64 = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (b64 && audioContextRef.current && audioContextRef.current.state !== 'closed') {
                            const ctx = audioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                            
                            const audioBuf = await decodeAudioData(decode(b64), ctx, settings.outputSampleRate, 1);
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuf;
                            source.connect(outputNode);
                            source.addEventListener('ended', () => {
                                sourcesRef.current.delete(source);
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuf.duration;
                            sourcesRef.current.add(source);
                        }
                    },
                    onclose: () => {
                        console.log("Live Session Closed");
                        setLiveActive(false);
                        setConnectionState('DISCONNECTED');
                    },
                    onerror: (e) => {
                        console.error(e);
                        // Network or Protocol Error
                        const msg = formatGeminiError(e);
                        setError("Live Session Error: " + msg);
                        setConnectionState('ERROR');
                        stopLiveSession();
                    }
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                    }
                }
            });
            sessionPromiseRef.current = sessionPromise;

        } catch (e) {
            console.error("Failed to start live session", e);
            setError(formatGeminiError(e));
            setConnectionState('ERROR');
        }
    };

    const stopLiveSession = () => {
        sessionPromiseRef.current?.then(session => {
            try {
                session.close();
            } catch (e) {
                console.warn("Session already closed", e);
            }
        });
        
        try {
            scriptProcessorRef.current?.disconnect();
        } catch (e) {}

        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        
        if (inputContextRef.current && inputContextRef.current.state !== 'closed') {
            try {
                inputContextRef.current.close();
            } catch(e) { console.warn("InputCtx close error", e); }
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            try {
                audioContextRef.current.close();
            } catch(e) { console.warn("AudioCtx close error", e); }
        }
        setLiveActive(false);
        setConnectionState('DISCONNECTED');
    };

    const togglePauseOutput = () => {
        if (!audioContextRef.current) return;
        
        if (isOutputPaused) {
            audioContextRef.current.resume();
        } else {
            audioContextRef.current.suspend();
        }
        setIsOutputPaused(!isOutputPaused);
    };

    // --- TTS Logic ---
    const handleTTS = async () => {
        if (!ttsText) return;
        setIsTtsProcessing(true);
        setError(null);
        try {
            const res = await generateSpeech(ttsText, selectedVoice);
            const b64 = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (b64) {
                const ctx = new AudioContext({ sampleRate: 24000 });
                const buf = await decodeAudioData(decode(b64), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = buf;
                source.connect(ctx.destination);
                source.start();
            }
        } catch (e) {
            console.error(e);
            setError(formatGeminiError(e));
        } finally {
            setIsTtsProcessing(false);
        }
    };

    // --- Translator Logic ---
    const handleTranslatorFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setTranslatorStatus('PROCESSING');
            const reader = new FileReader();
            reader.onloadend = () => {
                const b64 = (reader.result as string).split(',')[1];
                setTranslatorFile({ data: b64, mimeType: file.type });
                setTranslationResult("");
                setTranslatorStatus('IDLE');
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleRecordForTranslation = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            setTranslatorStatus('PROCESSING');
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                const chunks: BlobPart[] = [];
                
                mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'audio/webm' }); 
                    stream.getTracks().forEach(t => t.stop());
                    
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const b64 = (reader.result as string).split(',')[1];
                        setTranslatorFile({ data: b64, mimeType: 'audio/webm' });
                        setTranslationResult("");
                        setTranslatorStatus('IDLE');
                    };
                    reader.readAsDataURL(blob);
                };
                
                mediaRecorder.start();
                mediaRecorderRef.current = mediaRecorder;
                setIsRecording(true);
                setTranslatorStatus('RECORDING');
            } catch(e) {
                 setError("Microphone access failed.");
            }
        }
    };

    const handleTranslate = async () => {
        if (!translatorFile) return;
        setTranslatorStatus('TRANSLATING');
        setError(null);
        setTranslationResult("");
        try {
            const res = await translateAudio(translatorFile.data, translatorFile.mimeType, targetLang);
            if (res.text) {
                setTranslationResult(res.text);
            }
        } catch (e) {
            console.error(e);
            setError(formatGeminiError(e));
        } finally {
            setTranslatorStatus('IDLE');
        }
    };

    const handleSpeakTranslation = async () => {
        if (!translationResult) return;
        setTranslatorStatus('SPEAKING');
        try {
            // Use a default neutral voice for reading translations
            const res = await generateSpeech(translationResult, 'Kore');
            const b64 = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (b64) {
                const ctx = new AudioContext({ sampleRate: 24000 });
                const buf = await decodeAudioData(decode(b64), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = buf;
                source.connect(ctx.destination);
                source.onended = () => setTranslatorStatus('IDLE');
                source.start();
            } else {
                setTranslatorStatus('IDLE');
            }
        } catch (e) {
            console.error(e);
            setError("Failed to generate speech for translation.");
            setTranslatorStatus('IDLE');
        }
    };

    // --- Live Dictation Logic ---
    const toggleLiveDictation = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            setIsDictationProcessing(true);
        } else {
             try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                const chunks: BlobPart[] = [];
                setLiveDictationText(''); // Clear previous
                setError(null);
                
                mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'audio/webm' }); 
                    stream.getTracks().forEach(t => t.stop());
                    
                    // Immediately process
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                         try {
                            const b64 = (reader.result as string).split(',')[1];
                            const streamRes = await transcribeAudioStream(b64, 'audio/webm');
                            for await (const chunk of streamRes) {
                                const c = chunk as GenerateContentResponse;
                                if (c.text) {
                                    setLiveDictationText(prev => prev + c.text);
                                }
                            }
                         } catch (e) {
                             setError(formatGeminiError(e));
                         } finally {
                             setIsDictationProcessing(false);
                         }
                    };
                    reader.readAsDataURL(blob);
                };
                
                mediaRecorder.start();
                mediaRecorderRef.current = mediaRecorder;
                setIsRecording(true);
             } catch(e) {
                 setError("Microphone access failed.");
             }
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-950 p-4 lg:p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full space-y-8 relative">
                
                {/* Tabs */}
                <div className="flex flex-wrap justify-center gap-2">
                    {[
                        { id: 'LIVE', label: 'Realtime', icon: Radio },
                        { id: 'TTS', label: 'TTS', icon: Volume2 },
                        { id: 'LIVE_TRANSCRIBE', label: 'Dictation', icon: Keyboard },
                        { id: 'TRANSLATOR', label: 'Translator', icon: Languages }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => { setTab(t.id as any); stopLiveSession(); setError(null); }}
                            className={`flex items-center space-x-1 lg:space-x-2 px-3 py-2 lg:px-4 lg:py-2 rounded-xl transition-all font-medium text-xs lg:text-base ${
                                tab === t.id 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                            }`}
                        >
                            <t.icon size={16} className="lg:w-[18px] lg:h-[18px]" />
                            <span>{t.label}</span>
                        </button>
                    ))}
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-xl transition-colors ${showSettings ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                        title="Audio Settings"
                    >
                        <Settings size={20} />
                    </button>
                </div>

                {/* Settings Modal */}
                {showSettings && (
                    <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 absolute top-16 right-0 z-50 shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                <div className="p-1.5 bg-gray-800 rounded-lg">
                                    <Settings size={18} className="text-blue-400" />
                                </div>
                                Audio Settings
                            </h3>
                            <button 
                                onClick={() => setShowSettings(false)} 
                                className="p-1 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="space-y-6">
                            {/* Settings Content... */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block ml-1">
                                    Input Sample Rate
                                </label>
                                <div className="relative">
                                    <select 
                                        value={settings.inputSampleRate}
                                        onChange={(e) => handleSettingChange('inputSampleRate', Number(e.target.value))}
                                        className="w-full appearance-none bg-gray-950/50 border border-gray-700 hover:border-blue-500/50 text-white rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer"
                                    >
                                        <option value="16000">16,000 Hz (Standard)</option>
                                        <option value="24000">24,000 Hz (High)</option>
                                        <option value="44100">44,100 Hz (CD Quality)</option>
                                        <option value="48000">48,000 Hz (Studio)</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-3.5 text-gray-500 pointer-events-none" size={16} />
                                </div>
                            </div>
                            {/* ... more settings ... */}
                        </div>
                    </div>
                )}

                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 lg:p-8 min-h-[400px] flex flex-col justify-center items-center relative overflow-hidden">
                    
                    {error && (
                        <div className="absolute top-4 left-4 right-4 bg-red-900/20 border border-red-800 text-red-300 p-3 rounded-xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-2">
                            <AlertTriangle size={18} className="flex-shrink-0" />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    )}

                    {/* Live View */}
                    {tab === 'LIVE' && (
                        <div className="text-center space-y-8 z-10 w-full max-w-md">
                            <div className="relative mx-auto w-full max-w-lg h-64 flex items-center justify-center gap-2 lg:gap-6">
                                {/* Volume Meter */}
                                <div className="hidden sm:flex h-40 w-2 bg-gray-800 rounded-full overflow-hidden items-end relative shadow-inner">
                                    <div ref={volumeBarRef} className="w-full bg-green-500 transition-all duration-75 ease-out rounded-full" style={{ height: '0%' }}></div>
                                </div>

                                <div ref={canvasContainerRef} className="relative w-full aspect-square max-w-[300px] max-h-[300px] flex items-center justify-center">
                                    {/* Canvas Visualizer */}
                                    <canvas 
                                        ref={canvasRef} 
                                        className={`absolute inset-0 w-full h-full rounded-2xl transition-opacity duration-500 ${liveActive ? 'opacity-100' : 'opacity-10'}`}
                                    />
                                    
                                    {/* Center Interaction Element */}
                                    <div className={`relative z-10 transition-all duration-500 ${liveActive ? 'scale-100' : 'scale-125'}`}>
                                        <div className={`w-20 h-20 lg:w-24 lg:h-24 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                                            connectionState === 'CONNECTED' ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]' :
                                            connectionState === 'CONNECTING' ? 'bg-yellow-500/10 border-yellow-500 animate-pulse' :
                                            connectionState === 'ERROR' ? 'bg-red-500/10 border-red-500' :
                                            'bg-gray-800 border-gray-700'
                                        }`}>
                                            {connectionState === 'CONNECTING' ? <Loader2 className="animate-spin text-yellow-500" size={32} /> :
                                            connectionState === 'ERROR' ? <AlertTriangle className="text-red-500" size={32} /> :
                                            liveActive ? <Activity className="text-blue-500 animate-pulse" size={32} /> :
                                            <Mic className="text-gray-400" size={32} />
                                            }
                                        </div>
                                    </div>
                                    
                                    {/* Speech Badge */}
                                    <div ref={speechIndicatorRef} className="absolute -top-6 left-1/2 -translate-x-1/2 bg-green-900/50 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-500/30 opacity-0 transition-all duration-200 pointer-events-none whitespace-nowrap">
                                        SPEECH DETECTED
                                    </div>
                                </div>
                                
                                <div className="hidden sm:block w-2"></div>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-white transition-all">
                                    {connectionState === 'CONNECTED' ? "Voice Session Active" : 
                                     connectionState === 'CONNECTING' ? "Establishing Connection..." :
                                     "Ready to Connect"}
                                </h2>
                                <p className="text-gray-500 text-sm">
                                    {connectionState === 'CONNECTED' ? "Speak naturally to interact with Gemini" : "High-fidelity realtime audio"}
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button
                                    onClick={liveActive ? stopLiveSession : startLiveSession}
                                    className={`px-8 py-4 rounded-full font-bold text-lg flex items-center justify-center space-x-2 transition-all shadow-lg w-full sm:w-auto
                                        ${liveActive 
                                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20' 
                                            : 'bg-white text-gray-950 hover:bg-gray-200 shadow-white/10'
                                        }`}
                                >
                                    {liveActive ? <><StopCircle /> <span>End Session</span></> : <><Play /> <span>Start Live</span></>}
                                </button>
                                
                                {liveActive && (
                                    <button
                                        onClick={togglePauseOutput}
                                        className={`p-4 rounded-full transition-all border ${isOutputPaused ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
                                        title={isOutputPaused ? "Resume Audio" : "Pause Audio"}
                                    >
                                        {isOutputPaused ? <Play size={24} /> : <Pause size={24} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Other Tabs (TTS, Dictation, Translator) content structure remains similar but with responsive tweaks already inherent in flex/grid */}
                    {/* ... */}
                    {tab === 'TTS' && (
                        <div className="w-full max-w-lg space-y-6 z-10">
                            {/* ... TTS Content ... */}
                             <div className="flex justify-end">
                                <div className="relative w-48">
                                    <select 
                                        value={selectedVoice}
                                        onChange={(e) => setSelectedVoice(e.target.value)}
                                        className="w-full appearance-none bg-gray-950 border border-gray-700 text-white text-sm rounded-xl pl-3 pr-8 py-2.5 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                                    >
                                        <option value="Puck">Puck (Male)</option>
                                        <option value="Charon">Charon (Male)</option>
                                        <option value="Kore">Kore (Female)</option>
                                        <option value="Fenrir">Fenrir (Male)</option>
                                        <option value="Zephyr">Zephyr (Female)</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-3 text-gray-500 pointer-events-none" size={14} />
                                </div>
                            </div>
                            <textarea
                                value={ttsText}
                                onChange={(e) => setTtsText(e.target.value)}
                                className="w-full h-40 bg-gray-950 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 resize-none"
                                placeholder="Enter text to speak..."
                            />
                            <button
                                onClick={handleTTS}
                                disabled={isTtsProcessing || !ttsText}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold flex justify-center items-center shadow-lg shadow-blue-900/20"
                            >
                                {isTtsProcessing ? <Loader2 className="animate-spin" /> : <Volume2 />}
                                <span className="ml-2">Generate Speech ({selectedVoice})</span>
                            </button>
                        </div>
                    )}

                    {tab === 'LIVE_TRANSCRIBE' && (
                         <div className="w-full max-w-lg space-y-6 z-10 text-center">
                             {/* ... Dictation Content ... */}
                             <div className="relative mb-4">
                                <button
                                    onClick={toggleLiveDictation}
                                    className={`relative w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all z-10 shadow-xl ${
                                        isRecording ? 'bg-red-600' : 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
                                    }`}
                                >
                                    {isRecording && <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></div>}
                                    <Mic size={28} className={`relative z-20 ${isRecording ? 'text-white' : 'text-gray-400'}`} />
                                </button>
                                <p className="mt-4 text-lg font-medium text-white">
                                    {isRecording ? "Recording..." : "Tap to Dictate"}
                                </p>
                            </div>

                            {(liveDictationText || isDictationProcessing) && (
                                <div className="bg-gray-950 p-6 rounded-2xl text-left border border-gray-800 w-full min-h-[150px]">
                                    <div className="flex justify-between items-center mb-2">
                                         <span className="text-xs font-bold text-gray-500">TRANSCRIPT</span>
                                         {isDictationProcessing && <span className="text-xs text-blue-400 animate-pulse">Processing...</span>}
                                    </div>
                                    <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                                        {liveDictationText}
                                        {isDictationProcessing && <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-500 animate-pulse align-middle"></span>}
                                    </p>
                                </div>
                            )}
                         </div>
                    )}

                    {tab === 'TRANSLATOR' && (
                        <div className="w-full max-w-lg space-y-6 z-10">
                            {/* ... Translator Content ... */}
                             <div className="flex gap-4 mb-4">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500 font-bold mb-1 block uppercase">Target Language</label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-3 text-gray-400" size={16} />
                                        <select 
                                            value={targetLang}
                                            onChange={(e) => setTargetLang(e.target.value)}
                                            className="w-full appearance-none bg-gray-800 border border-gray-700 text-white text-sm rounded-xl pl-10 pr-8 py-2.5 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                                        >
                                            {SUPPORTED_LANGUAGES.map(lang => (
                                                <option key={lang} value={lang}>{lang}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3 text-gray-500 pointer-events-none" size={14} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    onClick={toggleRecordForTranslation}
                                    className={`group relative flex flex-col items-center justify-center p-6 rounded-2xl border transition-all h-40 overflow-hidden ${
                                        translatorStatus === 'RECORDING' 
                                        ? 'bg-red-900/10 border-red-500/50' 
                                        : 'bg-gray-900 border-gray-800 hover:border-gray-700 hover:bg-gray-800'
                                    }`}
                                >
                                    <div className={`p-4 rounded-full mb-3 transition-all ${translatorStatus === 'RECORDING' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 group-hover:bg-red-500/10 group-hover:text-red-500'}`}>
                                        <Mic size={28} />
                                    </div>
                                    <span className={`font-bold text-sm ${translatorStatus === 'RECORDING' ? 'text-red-400' : 'text-gray-300'}`}>
                                        {translatorStatus === 'RECORDING' ? "Stop Recording" : "Record Voice"}
                                    </span>
                                </button>
                                
                                {/* Upload Button logic... */}
                                 <div className="relative h-40">
                                    <input 
                                        type="file" 
                                        id="audio-upload" 
                                        accept="audio/*" 
                                        className="hidden" 
                                        onChange={handleTranslatorFile}
                                    />
                                    <label 
                                        htmlFor="audio-upload"
                                        className={`group relative flex flex-col items-center justify-center p-6 rounded-2xl border transition-all h-full cursor-pointer overflow-hidden ${
                                            translatorFile 
                                            ? 'bg-blue-900/10 border-blue-500/50' 
                                            : 'bg-gray-900 border-gray-800 hover:border-gray-700 hover:bg-gray-800'
                                        }`}
                                    >
                                        <div className={`p-4 rounded-full mb-3 transition-all ${translatorFile ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 group-hover:bg-blue-500/10 group-hover:text-blue-500'}`}>
                                            {translatorFile ? <FileAudio size={28} /> : <Upload size={28} />}
                                        </div>
                                        <span className={`font-bold text-sm ${translatorFile ? 'text-blue-400' : 'text-gray-300'}`}>
                                            {translatorFile ? "Change File" : "Upload Audio"}
                                        </span>
                                        {translatorFile && <span className="text-[10px] text-green-400 mt-1 font-medium">Ready to translate</span>}
                                    </label>
                                </div>
                            </div>
                            
                            {/* ... Rest of Translator ... */}
                             {(translatorFile || translatorStatus === 'RECORDING') && translatorStatus !== 'TRANSLATING' && translatorStatus !== 'SPEAKING' && (
                                <button
                                    onClick={handleTranslate}
                                    disabled={translatorStatus !== 'IDLE' && translatorStatus !== 'RECORDING'} 
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                                >
                                    <Languages size={18} />
                                    <span>Translate to {targetLang}</span>
                                </button>
                            )}

                             {translationResult && (
                                <div className="bg-gray-950 p-6 rounded-2xl text-left border border-gray-800 shadow-inner w-full animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Translation</span>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={handleSpeakTranslation} 
                                                disabled={translatorStatus === 'SPEAKING'}
                                                className="text-gray-500 hover:text-blue-400 text-xs flex items-center gap-1 transition-colors"
                                                title="Read Aloud"
                                            >
                                                {translatorStatus === 'SPEAKING' ? <Activity size={12} className="animate-spin" /> : <Volume2 size={12}/>} 
                                                Speak
                                            </button>
                                            <button onClick={() => {navigator.clipboard.writeText(translationResult)}} className="text-gray-500 hover:text-white text-xs flex items-center gap-1 transition-colors"><Check size={12}/> Copy</button>
                                        </div>
                                    </div>
                                    <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                                        {translationResult}
                                    </p>
                                </div>
                            )}

                        </div>
                    )}
                    
                    {/* Background decoration */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                         <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(59,130,246,0.3)_0%,rgba(0,0,0,0)_50%)]"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
