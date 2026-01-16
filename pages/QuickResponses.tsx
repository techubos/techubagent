import React from 'react';
import { QuickResponseManager } from '../components/crm/QuickResponseManager';

export const QuickResponses: React.FC = () => {
    return (
        <div className="h-[calc(100vh-6rem)] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
            <QuickResponseManager />
        </div>
    );
};
