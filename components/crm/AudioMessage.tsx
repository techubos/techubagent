import React, { useState, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { AudioPlayer } from '../AudioPlayer';

interface AudioMessageProps {
    audioUrl: string;
    transcription?: string;
}

export function AudioMessage({ audioUrl, transcription }: AudioMessageProps) {
    const [duration, setDuration] = useState<number | null>(null);
    const [showPlayer, setShowPlayer] = useState(false);

    useEffect(() => {
        if (!audioUrl) return;

        const audio = new Audio();
        audio.src = audioUrl;
        audio.preload = "metadata";

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.src = ''; // Clear source to stop potential loading
        };
    }, [audioUrl]);

    const formatDuration = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (showPlayer) {
        return (
            <AudioPlayer
                audioUrl={audioUrl}
                transcription={transcription}
                duration={duration || 0}
            />
        );
    }

    return (
        <div
            className="flex items-center gap-3 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 p-3 rounded-2xl cursor-pointer transition-all w-full max-w-[280px]"
            onClick={() => setShowPlayer(true)}
        >
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-zinc-950 shadow-lg shadow-emerald-500/20 shrink-0">
                <Play size={18} fill="currentColor" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="h-1 bg-white/10 rounded-full w-full mb-1.5 relative overflow-hidden">
                    {/* Waveform placeholder */}
                    <div className="absolute inset-y-0 left-0 bg-primary/30 w-1/3" />
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    <span>{duration ? formatDuration(duration) : '...'}</span>
                    <Volume2 size={12} className="opacity-50" />
                </div>
            </div>
        </div>
    );
}
