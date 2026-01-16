import React, { useState } from 'react';
import { ABTestDashboard } from '../components/ABTestDashboard';
import { CreateExperiment } from '../components/CreateExperiment';
import { Plus } from 'lucide-react';

export const Experiments: React.FC = () => {
    const [isCreating, setIsCreating] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    return (
        <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-100">Growth Engineering</h1>
                    <p className="text-zinc-500 mt-1">Gerencie testes A/B e experimentos de conversão.</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium shadow-lg shadow-primary/20 flex items-center gap-2 transition-all"
                >
                    <Plus size={20} />
                    Novo Experimento
                </button>
            </div>

            <div className="flex-1">
                <ABTestDashboard key={refreshKey} />
            </div>

            {isCreating && (
                <CreateExperiment
                    onClose={() => setIsCreating(false)}
                    onSuccess={() => {
                        setRefreshKey(prev => prev + 1);
                        setIsCreating(false);
                    }}
                />
            )}
        </div>
    );
};
