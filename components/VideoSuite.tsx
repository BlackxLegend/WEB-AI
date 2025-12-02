
import React, { useState } from 'react';
import { generateVideo, analyzeVideo, formatGeminiError } from '../services/geminiService';
import { Video, Film, Upload, AlertTriangle, Key } from 'lucide-react';
import { VeoConfig } from '../types';

export const VideoSuite: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'GENERATE' | 'ANALYZE'>('GENERATE');
  const [config, setConfig] = useState<VeoConfig>({ aspectRatio: '16:9', resolution: '720p' });
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [statusType, setStatusType] = useState<'info' | 'error'>('info');
  const [refImage, setRefImage] = useState<{data: string, mimeType: string} | undefined>(undefined);
  const [videoFile, setVideoFile] = useState<{data: string, mimeType: string} | undefined>(undefined);

  const checkKey = async () => {
    const win = window as any;
    if (win.aistudio && win.aistudio.hasSelectedApiKey) {
        try {
            const hasKey = await win.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                setStatus("Waiting for API Key selection...");
                setStatusType('info');
                await win.aistudio.openSelectKey();
            }
            return true;
        } catch (e) {
            console.error("Key selection failed", e);
            setStatus("API Key selection failed.");
            setStatusType('error');
            return false;
        }
    }
    return true; // Fallback for dev environments without the special window object
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    
    // Key Check
    const keyReady = await checkKey();
    if (!keyReady) return;

    setIsLoading(true);
    setVideoUrl(null);
    setStatus('Initializing Veo session...');
    setStatusType('info');

    try {
      const operation = await generateVideo(prompt, config, refImage);
      
      setStatus('Rendering video... This may take a minute.');
      // The service polls until done.
      
      const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (uri) {
         // Append key for fetching if using default env key (not relevant for user selected key usually, but safe to try/catch)
         // NOTE: With user selected key via window.aistudio, the fetch might need headers or the key appended if provided.
         // The prompt says: "You must append an API key when fetching from the download link."
         // Since we use window.aistudio, we rely on process.env.API_KEY being injected or available.
         // If process.env.API_KEY is available (injected by the iframe wrapper), use it.
         const fetchUrl = `${uri}&key=${process.env.API_KEY || ''}`;
         
         const res = await fetch(fetchUrl);
         if (!res.ok) throw new Error("Failed to download video bytes");
         const blob = await res.blob();
         setVideoUrl(URL.createObjectURL(blob));
         setStatus('Completed');
         setStatusType('info');
      } else {
         throw new Error("No video URI returned");
      }

    } catch (e: any) {
      console.error(e);
      setStatus(formatGeminiError(e));
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile || !prompt) return;
    setIsLoading(true);
    setStatus('Analyzing video frames...');
    setStatusType('info');
    setAnalysisText(null);

    try {
        const res = await analyzeVideo(prompt, videoFile.data, videoFile.mimeType);
        setAnalysisText(res.text || null);
        setStatus('Analysis complete');
        setStatusType('info');
    } catch (e: any) {
        setStatus(formatGeminiError(e));
        setStatusType('error');
    } finally {
        setIsLoading(false);
    }
  }

  const handleRefImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const b64 = (reader.result as string).split(',')[1];
            setRefImage({ data: b64, mimeType: file.type });
        };
        reader.readAsDataURL(file);
    }
  }

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const b64 = (reader.result as string).split(',')[1];
            setVideoFile({ data: b64, mimeType: file.type });
        };
        reader.readAsDataURL(file);
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        {/* Toggle Mode */}
        <div className="flex space-x-1 bg-gray-900 p-1 rounded-xl w-fit mx-auto">
            <button 
                onClick={() => setMode('GENERATE')}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${mode === 'GENERATE' ? 'bg-gray-800 text-green-400 shadow' : 'text-gray-500 hover:text-white'}`}
            >
                Veo Generation
            </button>
            <button 
                onClick={() => setMode('ANALYZE')}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${mode === 'ANALYZE' ? 'bg-gray-800 text-purple-400 shadow' : 'text-gray-500 hover:text-white'}`}
            >
                Video Analysis
            </button>
        </div>

        {/* Info Box */}
        {mode === 'GENERATE' && (
             <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl flex items-start space-x-3">
                <Key className="text-indigo-400 flex-shrink-0 mt-1" size={20} />
                <div className="text-sm text-indigo-200">
                    <strong>Note:</strong> Veo requires a paid API key. You will be prompted to select a Google Cloud Project key via the secure dialog if you haven't already. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline hover:text-white">Learn more about billing</a>.
                </div>
            </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
            
            {/* Input Section */}
            <div className="space-y-4">
                <label className="text-gray-400 text-sm font-semibold uppercase tracking-wider">
                    {mode === 'GENERATE' ? 'Prompt' : 'Question about video'}
                </label>
                <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-green-500 min-h-[120px]"
                    placeholder={mode === 'GENERATE' ? "Cinematic shot of a cybernetic tiger running through neon rain..." : "What is happening in this video?"}
                />
            </div>

            {/* Configs for Generation */}
            {mode === 'GENERATE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                         <label className="text-gray-400 text-sm font-medium">Aspect Ratio</label>
                         <div className="grid grid-cols-2 gap-2">
                             {(['16:9', '9:16'] as const).map(r => (
                                 <button 
                                    key={r}
                                    onClick={() => setConfig({...config, aspectRatio: r})}
                                    className={`py-2 rounded-lg border text-sm ${config.aspectRatio === r ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-gray-700 bg-gray-950 text-gray-500'}`}
                                 >
                                    {r}
                                 </button>
                             ))}
                         </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-gray-400 text-sm font-medium">Image-to-Video (Optional)</label>
                        <input type="file" id="ref-upload" className="hidden" accept="image/*" onChange={handleRefImage} />
                        <label htmlFor="ref-upload" className="block w-full border border-dashed border-gray-700 rounded-lg p-2 text-center text-sm text-gray-500 cursor-pointer hover:border-green-500 hover:text-green-500 transition-colors">
                            {refImage ? "Image Selected (Click to change)" : "Upload Start Image"}
                        </label>
                    </div>
                </div>
            )}

            {/* Configs for Analysis */}
            {mode === 'ANALYZE' && (
                <div className="space-y-2">
                    <label className="text-gray-400 text-sm font-medium">Upload Video Clip</label>
                    <input type="file" id="vid-upload" className="hidden" accept="video/*" onChange={handleVideoUpload} />
                    <label htmlFor="vid-upload" className="flex items-center justify-center w-full border border-dashed border-gray-700 rounded-lg h-24 text-gray-500 cursor-pointer hover:border-purple-500 hover:text-purple-500 transition-colors bg-gray-950">
                        {videoFile ? <span className="text-purple-400 font-bold">Video Selected</span> : <div className="flex flex-col items-center"><Upload size={20} /><span>Max 20MB for demo</span></div>}
                    </label>
                </div>
            )}

            {/* Status & Action */}
            <div className="pt-4 border-t border-gray-800">
                {isLoading && (
                    <div className={`mb-4 flex items-center space-x-3 ${statusType === 'error' ? 'text-red-400' : 'text-blue-400'} animate-pulse`}>
                        {statusType === 'error' ? <AlertTriangle size={20} /> : <Film className="animate-spin" />}
                        <span>{status}</span>
                    </div>
                )}
                
                <button 
                    onClick={mode === 'GENERATE' ? handleGenerate : handleAnalyze}
                    disabled={isLoading || !prompt || (mode === 'ANALYZE' && !videoFile)}
                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-all
                        ${isLoading || !prompt 
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                            : mode === 'GENERATE' 
                                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white'
                        }`}
                >
                    <Video size={20} />
                    <span>{mode === 'GENERATE' ? 'Generate Video with Veo' : 'Analyze Video'}</span>
                </button>
            </div>
        </div>

        {/* Results */}
        {videoUrl && mode === 'GENERATE' && (
             <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
                 <video src={videoUrl} controls autoPlay loop className="w-full" />
                 <div className="p-4 flex justify-between items-center bg-gray-900">
                     <span className="text-green-400 font-medium">Veo Generation Complete</span>
                     <a href={videoUrl} download="veo-generation.mp4" className="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded text-white transition-colors">
                         Download MP4
                     </a>
                 </div>
             </div>
        )}

        {analysisText && mode === 'ANALYZE' && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-purple-400 mb-2">Video Insights</h3>
                <p className="text-gray-300 leading-relaxed">{analysisText}</p>
            </div>
        )}

      </div>
    </div>
  );
};
