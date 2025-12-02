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
          // Relaxed checks for mobile drawer items that might be partially off-screen
          const isOffScreen = rect.bottom < 0 || rect.top > window.innerHeight;
          const isHidden = rect.width === 0 && rect.height === 0;

          if (isOffScreen || isHidden) {
              // Element exists but is hidden (e.g. inside closed mobile drawer)
              // Fallback to center view
              setTargetRect(null);
          } else {
              setTargetRect(rect);
              // Only scroll if strictly needed
              if (rect.top < 0 || rect.bottom > window.innerHeight) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
              }
          }
        } else {
            setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };

    // Small delay to allow rendering/layout to settle
    const timer = setTimeout(updatePosition, 250);
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
    
    // Responsive width logic
    const margin = 16;
    const maxTooltipWidth = 320;
    // Ensure tooltip never exceeds viewport width minus margins
    const tooltipWidth = Math.min(maxTooltipWidth, viewportWidth - (margin * 2));

    if (!targetRect) {
      // Centered Modal
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${tooltipWidth}px`,
        maxWidth: '90vw',
        position: 'fixed' as const
      };
    }

    let top = 0;
    let left = 0;

    // Determine effective position
    // On mobile, force 'bottom' usually to avoid squishing
    let pos = currentStep.position || 'bottom';
    
    // Override position for mobile if 'left' or 'right' are requested
    // as there is rarely enough horizontal space
    if (isMobile && (pos === 'left' || pos === 'right')) {
        const spaceBelow = viewportHeight - targetRect.bottom;
        const spaceAbove = targetRect.top;
        pos = spaceBelow > 250 ? 'bottom' : (spaceAbove > 250 ? 'top' : 'bottom');
    }

    // Basic Positioning Logic relative to viewport
    switch (pos) {
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - 100; 
        left = targetRect.right + 12;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - 100;
        left = targetRect.left - tooltipWidth - 12;
        break;
      case 'bottom':
        top = targetRect.bottom + 12;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'top':
      default:
        top = targetRect.top - 12 - 200; // rough estimate, rectified later
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
    }

    // --- Safety Clamping (The most important part for mobile) ---
    
    // 1. Horizontal Clamp: Keep fully within viewport with margins
    if (left < margin) left = margin;
    if (left + tooltipWidth > viewportWidth - margin) {
        left = viewportWidth - tooltipWidth - margin;
    }
    
    // 2. Vertical Clamp
    // Ensure we don't go off top
    if (top < margin) top = margin;
    
    // Ensure we don't go off bottom
    // We assume a max height for the card to calculate 'bottom' collision roughly
    const estimatedCardHeight = 220; 
    if (top + estimatedCardHeight > viewportHeight - margin) {
        // If bottom overflows, try flipping to top
        if (pos === 'bottom') {
             const flippedTop = targetRect.top - margin - estimatedCardHeight;
             // Only flip if top has space
             if (flippedTop > margin) {
                 top = flippedTop;
             } else {
                 // If neither fits, stick to bottom of viewport
                 top = viewportHeight - estimatedCardHeight - margin;
             }
        } else {
             top = viewportHeight - estimatedCardHeight - margin;
        }
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      position: 'fixed' as const
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
                   className="absolute inset-0 bg-black/70 transition-colors duration-500"
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
                    className="absolute border-2 border-blue-500 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300 ease-out animate-pulse"
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
                <h3 className="text-lg font-bold mb-2 text-white">{currentStep.title}</h3>
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