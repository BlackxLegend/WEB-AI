
import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

export interface TourStep {
  targetId?: string; // If undefined, shows centered modal
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TourOverlayProps {
  steps: TourStep[];
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export const TourOverlay: React.FC<TourOverlayProps> = ({ steps, isOpen, onComplete, onSkip }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  
  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (currentStep.targetId) {
        const el = document.getElementById(currentStep.targetId);
        if (el) {
          const rect = el.getBoundingClientRect();
          
          // Check if element is effectively visible (on screen and has size)
          const isOffScreen = rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth;
          const isHidden = rect.width === 0 && rect.height === 0;

          if (isOffScreen || isHidden) {
              // Element exists but is hidden (e.g. inside closed mobile drawer)
              // Fallback to center view
              setTargetRect(null);
          } else {
              setTargetRect(rect);
              el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          }
        } else {
            setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };

    // Small delay to allow rendering/layout to settle
    const timer = setTimeout(updatePosition, 100);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);
    
    return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
    };
  }, [currentStepIndex, isOpen, currentStep.targetId]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // Calculate Tooltip Position
  const getTooltipStyle = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth < 640;
    
    // Responsive width: max 320px, but on small screens use 90% of viewport
    const tooltipWidth = Math.min(320, viewportWidth - 32); 

    if (!targetRect) {
      // Centered Modal
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${tooltipWidth}px`,
        maxWidth: '90vw',
        position: 'fixed'
      };
    }

    const margin = 12;
    let top = 0;
    let left = 0;

    // Determine effective position
    // On mobile, force 'top' or 'bottom' to avoid horizontal cramping
    let pos = currentStep.position || 'bottom';
    if (isMobile && (pos === 'left' || pos === 'right')) {
        // Choose based on vertical space available
        const spaceBelow = viewportHeight - targetRect.bottom;
        const spaceAbove = targetRect.top;
        pos = spaceBelow > 200 ? 'bottom' : (spaceAbove > 200 ? 'top' : 'bottom');
    }

    // Basic Positioning Logic relative to viewport (since we use fixed position for overlay)
    switch (pos) {
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - 100; 
        left = targetRect.right + margin;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - 100;
        left = targetRect.left - tooltipWidth - margin;
        break;
      case 'bottom':
        top = targetRect.bottom + margin;
        // Center horizontally relative to target, but clamp later
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'top':
      default:
        // Use a rough estimate for height or let clamp fix it
        top = targetRect.top - margin - 200; 
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
    }

    // --- Safety Clamping ---
    
    // 1. Horizontal Clamp
    if (left < 16) left = 16;
    if (left + tooltipWidth > viewportWidth - 16) left = viewportWidth - tooltipWidth - 16;
    
    // 2. Vertical Clamp
    // Ensure we don't go off top
    if (top < 16) top = 16;
    // Ensure we don't go off bottom (assuming ~250px height for tooltip)
    const estimatedHeight = 250; 
    if (top + estimatedHeight > viewportHeight) {
        // If it goes off bottom, try to flip to top if mostly aiming for bottom
        if (pos === 'bottom') {
             const newTop = targetRect.top - margin - estimatedHeight;
             if (newTop > 16) top = newTop;
             else top = viewportHeight - estimatedHeight - 16; // last resort: stick to bottom edge
        } else {
             top = viewportHeight - estimatedHeight - 16;
        }
    }

    // On mobile, if aiming for 'top', sometimes targetRect.top is small, so we might need to push it down
    // But usually 'bottom' is safer.
    
    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      position: 'fixed'
    };
  };

  const style = getTooltipStyle();

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Backdrop / Spotlight Effect */}
        {targetRect ? (
            <div className="absolute inset-0 bg-transparent">
                {/* Dark overlay with hole */}
                <div 
                   className="absolute inset-0 bg-black/60 transition-colors duration-500"
                   style={{
                       clipPath: `polygon(
                           0% 0%, 
                           0% 100%, 
                           100% 100%, 
                           100% 0%, 
                           0% 0%, 
                           ${targetRect.left}px ${targetRect.top}px, 
                           ${targetRect.right}px ${targetRect.top}px, 
                           ${targetRect.right}px ${targetRect.bottom}px, 
                           ${targetRect.left}px ${targetRect.bottom}px, 
                           ${targetRect.left}px ${targetRect.top}px
                       )`
                   }}
                ></div>
                
                {/* Border Ring around target */}
                <div 
                    className="absolute border-2 border-blue-500 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300 ease-out"
                    style={{
                        top: targetRect.top - 4,
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                    }}
                />
            </div>
        ) : (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto" />
        )}

        {/* Tooltip Card */}
        <div 
            className="absolute bg-gray-900 border border-gray-700 text-white p-6 rounded-2xl shadow-2xl flex flex-col gap-4 transition-all duration-300 pointer-events-auto"
            style={style as React.CSSProperties}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-600 rounded-lg">
                        <Sparkles size={16} className="text-white" />
                    </div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Step {currentStepIndex + 1} of {steps.length}
                    </span>
                </div>
                <button onClick={onSkip} className="text-gray-500 hover:text-white transition-colors">
                    <X size={18} />
                </button>
            </div>

            <div>
                <h3 className="text-xl font-bold mb-2 text-white">{currentStep.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{currentStep.content}</p>
            </div>

            <div className="flex items-center justify-between pt-2">
                <button 
                    onClick={handleBack}
                    disabled={currentStepIndex === 0}
                    className="flex items-center text-sm text-gray-500 hover:text-white disabled:opacity-0 transition-all"
                >
                    <ChevronLeft size={16} /> Back
                </button>

                <button 
                    onClick={handleNext}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                >
                    {currentStepIndex === steps.length - 1 ? "Get Started" : "Next"}
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    </div>
  );
};
