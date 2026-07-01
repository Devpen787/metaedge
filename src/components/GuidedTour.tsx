import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Swords, Terminal, ArrowRight, X, Sparkles } from 'lucide-react';

interface GuidedTourProps {
  onComplete: () => void;
}

const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to MetaEdge',
    description: 'The ultimate AI-driven trading platform. Learn to deploy autonomous agents, execute complex strategies via text, and compete in the Agent Arena.',
    icon: Sparkles,
    color: 'text-indigo-400'
  },
  {
    id: 'copilot',
    title: 'Swarm Copilot',
    description: 'Your intelligent assistant. Use natural language to ask for market insights, token analysis, or explain complex DeFi concepts in simple terms.',
    icon: Bot,
    color: 'text-emerald-400'
  },
  {
    id: 'intent',
    title: 'Intent Solver',
    description: 'For the pros. Type what you want to do (e.g., "Deploy an arb bot on ETH/USDC with $5k") and the AI will compile it into an executable strategy.',
    icon: Terminal,
    color: 'text-amber-400'
  },
  {
    id: 'arena',
    title: 'Agent Arena',
    description: 'Test your skills risk-free. Enter trading leagues, deploy your tuned agents against others, and climb the global leaderboards.',
    icon: Swords,
    color: 'text-rose-400'
  }
];

export default function GuidedTour({ onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep === TOUR_STEPS.length - 1) {
      onComplete();
    } else {
      setCurrentStep(c => c + 1);
    }
  };

  const Step = TOUR_STEPS[currentStep];
  const Icon = Step.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        key={Step.id}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        className="bg-slate-900 border border-slate-700/80 rounded-3xl p-8 w-full max-w-lg shadow-2xl relative overflow-hidden"
      >
        <button
          onClick={onComplete}
          className="absolute top-6 right-6 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center mt-4">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 shadow-inner relative group">
            <div className={`absolute inset-0 opacity-20 blur-xl rounded-full ${Step.color.replace('text-', 'bg-')}`} />
            <Icon className={`w-12 h-12 relative z-10 ${Step.color}`} />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-4">{Step.title}</h2>
          <p className="text-slate-400 leading-relaxed mb-8">
            {Step.description}
          </p>

          <div className="w-full flex items-center justify-between">
            <div className="flex gap-2">
              {TOUR_STEPS.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-2 h-2 rounded-full transition-all ${idx === currentStep ? 'bg-indigo-500 w-4' : 'bg-slate-700'}`}
                />
              ))}
            </div>
            <button
              onClick={nextStep}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-colors"
            >
              {currentStep === TOUR_STEPS.length - 1 ? 'Get Started' : 'Next'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
