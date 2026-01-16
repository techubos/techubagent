import React, { useState } from 'react';
import { WelcomeStep } from './steps/WelcomeStep';
import { WhatsAppStep } from './steps/WhatsAppStep';
import { BusinessHoursStep } from './steps/BusinessHoursStep';
import { KnowledgeBaseStep } from './steps/KnowledgeBaseStep';
import { TestStep } from './steps/TestStep';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface OnboardingData {
    whatsappConnected: boolean;
    businessHours: any;
    knowledgeBase: any;
    testPassed: boolean;
}

export function OnboardingWizard() {
    const [step, setStep] = useState(1);
    const [data, setData] = useState<OnboardingData>({
        whatsappConnected: false,
        businessHours: null,
        knowledgeBase: null,
        testPassed: false
    });

    const totalSteps = 5;

    const handleNext = () => {
        if (step < totalSteps) setStep(step + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const canProceed = () => {
        if (step === 1) return true;
        if (step === 2) return data.whatsappConnected;
        if (step === 3) return !!data.businessHours;
        if (step === 4) return !!data.knowledgeBase;
        if (step === 5) return data.testPassed;
        return false;
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="max-w-3xl w-full bg-zinc-900/50 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col items-center p-8 md:p-12 relative">

                {/* Progress Bar */}
                <div className="w-full mb-12 flex items-center justify-between gap-2 relative">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/5 -translate-y-1/2 z-0" />
                    <div
                        className="absolute top-1/2 left-0 h-0.5 bg-primary transition-all duration-500 -translate-y-1/2 z-0"
                        style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
                    />

                    {[1, 2, 3, 4, 5].map((s) => (
                        <div
                            key={s}
                            className={`
                relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500
                ${s < step ? 'bg-primary text-zinc-950' : s === step ? 'bg-zinc-800 text-white border-2 border-primary/50' : 'bg-zinc-900 text-zinc-600 border border-white/5'}
              `}
                        >
                            {s < step ? <Check size={18} /> : s}
                            <span className={`absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${s === step ? 'text-primary' : 'text-zinc-600'}`}>
                                {s === 1 ? 'Eco' : s === 2 ? 'Whats' : s === 3 ? 'Horas' : s === 4 ? 'Conhec' : 'Teste'}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="w-full flex-1 min-h-[400px] flex flex-col py-4 overflow-y-auto custom-scrollbar">
                    {step === 1 && <WelcomeStep onNext={handleNext} />}
                    {step === 2 && <WhatsAppStep onConnect={(status) => setData({ ...data, whatsappConnected: status })} />}
                    {step === 3 && <BusinessHoursStep onSave={(hours) => { setData({ ...data, businessHours: hours }); handleNext(); }} />}
                    {step === 4 && <KnowledgeBaseStep onSave={(kb) => { setData({ ...data, knowledgeBase: kb }); handleNext(); }} />}
                    {step === 5 && <TestStep onPass={() => setData({ ...data, testPassed: true })} />}
                </div>

                {/* Navigation */}
                <div className="w-full mt-12 flex justify-between gap-4">
                    <button
                        onClick={handleBack}
                        disabled={step === 1}
                        className={`
              flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all
              ${step === 1 ? 'opacity-0 pointer-events-none' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white'}
            `}
                    >
                        <ChevronLeft size={20} />
                        Anterior
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!canProceed()}
                        className={`
              flex items-center gap-2 px-8 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary/20
              ${canProceed()
                                ? 'bg-primary text-zinc-950 hover:scale-105 active:scale-95'
                                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}
            `}
                    >
                        {step === totalSteps ? 'Concluir Setup' : 'Próximo'}
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
