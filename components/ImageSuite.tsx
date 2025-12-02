
import React, { useState } from 'react';
import { generateImage, editImage, analyzeImage, formatGeminiError } from '../services/geminiService';
import { Wand2, Image as ImageIcon, ScanEye, Download, RefreshCcw, Upload, AlertCircle } from 'lucide-react';

type Mode = 'GENERATE' | 'EDIT' | 'ANALYZE';

export const ImageSuite: React.FC = () => {
  const [mode, setMode] = useState<Mode>('GENERATE');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{data: string, mimeType: string} | null>(null);
  
  // Configs
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageSize, setImageSize] = useState("1K");
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Strip prefix
        const base64Data = base64String.split(',')[1];
        setSelectedImage({ data: base64Data, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAction = async () => {
    setIsLoading(true);
    setError(null);
    setResultImage(null);
    setResultText(null);

    try {
      if (mode === 'GENERATE') {
        try {
           // Check for key selection for high quality image gen
           const win = window as any;
           if (win.aistudio && win.aistudio.hasSelectedApiKey) {
              const hasKey = await win.aistudio.hasSelectedApiKey();
              if (!hasKey) {
                 await win.aistudio.openSelectKey();
              }
           }
        } catch(e) {
           // Fallback or ignore if not available in this env
           console.warn("Key selection skipped or failed", e);
        }

        const res = await generateImage(prompt, { aspectRatio, imageSize });
        // Handle response
        // Flash Image/Pro Image might return inline data
        const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part && part.inlineData && part.inlineData.data) {
           setResultImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
        } else {
            // Check for Imagen style
            // @ts-ignore
            if (res.generatedImages?.[0]) {
                 // @ts-ignore
                 setResultImage(`data:image/png;base64,${res.generatedImages[0].image.imageBytes}`);
            } else {
                 throw new Error("No image returned");
            }
        }

      } else if (mode === 'EDIT') {
        if (!selectedImage) throw new Error("Please upload an image first.");
        const res = await editImage(prompt, selectedImage.data, selectedImage.mimeType);
        const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part && part.inlineData) {
            setResultImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
        } else {
            throw new Error("No edited image returned.");
        }

      } else if (mode === 'ANALYZE') {
        if (!selectedImage) throw new Error("Please upload an image first.");
        const res = await analyzeImage(prompt, selectedImage.data, selectedImage.mimeType);
        setResultText(res.text || null);
      }
    } catch (err: any) {
      setError(formatGeminiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        
        {/* Header Tabs */}
        <div className="grid grid-cols-3 gap-4 bg-gray-900 p-1 rounded-xl">
          {[
            { id: 'GENERATE', label: 'Generate', icon: Wand2, desc: 'Gemini 3 Pro Image' },
            { id: 'EDIT', label: 'Edit', icon: RefreshCcw, desc: 'Gemini 2.5 Flash Image' },
            { id: 'ANALYZE', label: 'Analyze', icon: ScanEye, desc: 'Gemini 3 Pro Vision' }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id as Mode); setError(null); }}
              className={`flex flex-col items-center justify-center py-4 rounded-lg transition-all ${
                mode === m.id ? 'bg-gray-800 text-blue-400 shadow-md ring-1 ring-gray-700' : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-300'
              }`}
            >
              <m.icon size={24} className="mb-2" />
              <span className="font-semibold">{m.label}</span>
              <span className="text-xs opacity-60 mt-1">{m.desc}</span>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          
          {/* File Upload for Edit/Analyze */}
          {(mode === 'EDIT' || mode === 'ANALYZE') && (
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-blue-500/50 transition-colors bg-gray-950/50">
               <input type="file" id="img-upload" accept="image/*" className="hidden" onChange={handleFileChange} />
               <label htmlFor="img-upload" className="cursor-pointer flex flex-col items-center">
                  {selectedImage ? (
                      <div className="relative">
                          <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} alt="Selected" className="h-48 object-contain rounded-lg shadow-lg" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                              <span className="bg-black/70 text-white px-3 py-1 rounded-full text-sm">Change Image</span>
                          </div>
                      </div>
                  ) : (
                      <>
                        <Upload size={40} className="text-gray-600 mb-3" />
                        <span className="text-gray-400 font-medium">Click to upload an image</span>
                      </>
                  )}
               </label>
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">
               {mode === 'ANALYZE' ? 'What should I look for?' : 'Describe your vision'}
            </label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px]"
              placeholder={mode === 'ANALYZE' ? "Describe this image..." : "A futuristic city with flying cars..."}
            />
          </div>

          {/* Generation Options */}
          {mode === 'GENERATE' && (
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400">Aspect Ratio</label>
                    <select 
                        value={aspectRatio} 
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white"
                    >
                        <option value="1:1">1:1 (Square)</option>
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="4:3">4:3</option>
                        <option value="3:4">3:4</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400">Resolution</label>
                    <select 
                        value={imageSize} 
                        onChange={(e) => setImageSize(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white"
                    >
                        <option value="1K">1K</option>
                        <option value="2K">2K (High Res)</option>
                        <option value="4K">4K (Ultra Res)</option>
                    </select>
                </div>
            </div>
          )}

          {/* Action Button */}
          <button 
             onClick={handleAction}
             disabled={isLoading || !prompt}
             className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-all
                ${isLoading || !prompt 
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/20'
                }`}
          >
             {isLoading ? <span className="animate-spin mr-2">⏳</span> : <Wand2 size={20} />}
             <span>{mode === 'GENERATE' ? 'Generate Image' : mode === 'EDIT' ? 'Edit Image' : 'Analyze Image'}</span>
          </button>

          {/* Errors */}
          {error && (
             <div className="bg-red-900/20 border border-red-800 text-red-300 p-4 rounded-lg flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={20} className="flex-shrink-0" />
                <span>{error}</span>
             </div>
          )}
        </div>

        {/* Results */}
        {(resultImage || resultText) && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4">
               <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ImageIcon className="text-purple-500" /> Result
               </h3>
               {resultImage && (
                   <div className="relative group rounded-xl overflow-hidden border border-gray-700">
                      <img src={resultImage} alt="Result" className="w-full object-contain max-h-[600px] bg-black/50" />
                      <a href={resultImage} download="gemini-art.png" className="absolute top-4 right-4 bg-black/70 hover:bg-black text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                         <Download size={20} />
                      </a>
                   </div>
               )}
               {resultText && (
                   <div className="prose prose-invert max-w-none bg-gray-950 p-6 rounded-xl border border-gray-800">
                      <p>{resultText}</p>
                   </div>
               )}
            </div>
        )}
      </div>
    </div>
  );
};
