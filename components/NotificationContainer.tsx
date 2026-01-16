import React from 'react';
import { useNotifications } from '../stores/notifications';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export function NotificationContainer() {
    const { notifications, remove } = useNotifications();

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="text-emerald-500" size={20} />;
            case 'error': return <AlertCircle className="text-red-500" size={20} />;
            case 'warning': return <AlertTriangle className="text-amber-500" size={20} />;
            default: return <Info className="text-blue-500" size={20} />;
        }
    };

    const getColorClass = (type: string) => {
        switch (type) {
            case 'success': return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200';
            case 'error': return 'border-red-500/20 bg-red-500/5 text-red-200';
            case 'warning': return 'border-amber-500/20 bg-amber-500/5 text-amber-200';
            default: return 'border-blue-500/20 bg-blue-500/5 text-blue-200';
        }
    };

    return (
        <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
            <AnimatePresence mode="popLayout">
                {notifications.map((n) => (
                    <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className={`
              pointer-events-auto w-full p-4 rounded-2xl border backdrop-blur-3xl shadow-2xl flex items-start gap-3 relative overflow-hidden group
              ${getColorClass(n.type)}
            `}
                    >
                        {/* Background Glow */}
                        <div className={`absolute inset-0 opacity-10 blur-xl -z-10 bg-current`} />

                        <div className="shrink-0 mt-0.5">
                            {getIcon(n.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-black uppercase tracking-widest mb-1 opacity-90">{n.title}</h4>
                            <p className="text-xs font-medium leading-relaxed opacity-70 mb-2">{n.message}</p>

                            {/* Progress Bar (Visual only, to indicate time remaining) */}
                            <div className="h-0.5 bg-current opacity-10 rounded-full w-full overflow-hidden">
                                <motion.div
                                    initial={{ width: "100%" }}
                                    animate={{ width: "0%" }}
                                    transition={{ duration: (n.duration || 5000) / 1000, ease: "linear" }}
                                    className="h-full bg-current opacity-40"
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => remove(n.id)}
                            className="shrink-0 p-1 hover:bg-white/5 rounded-lg transition-colors opacity-40 group-hover:opacity-100"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
