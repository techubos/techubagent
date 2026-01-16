import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../services/supabaseClient';

interface AudioRecorderProps {
    onSend: (audioUrl: string, duration: number) => void;
    onCancel: () => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onSend, onCancel }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Waveform visualization (simulated)
    const [volumeLevels, setVolumeLevels] = useState<number[]>(new Array(20).fill(10));

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const rafRef = useRef<number | null>(null); // Animation frame

    useEffect(() => {
        startRecording();
        return () => stopRecordingCleanup();
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            // Audio Context for Visualizer
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioCtx.createAnalyser();
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 64;
            analyserRef.current = analyser;
            dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

            const updateVisualizer = () => {
                if (!analyserRef.current || !dataArrayRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArrayRef.current);
                // Simple downsampling for UI
                const levels: number[] = [];
                for (let i = 0; i < 20; i++) {
                    levels.push(Math.max(10, (dataArrayRef.current[i] || 0) / 2));
                }
                setVolumeLevels(levels);
                rafRef.current = requestAnimationFrame(updateVisualizer);
            }
            updateVisualizer();

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                stopRecordingCleanup();
            };

            mediaRecorder.start();
            setIsRecording(true);

            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            toast.error("Erro ao acessar microfone. Verifique as permissões.");
            onCancel();
        }
    };

    const stopRecordingCleanup = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const handleStop = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleUploadAndSend = async () => {
        if (!audioBlob) return;
        setIsUploading(true);
        try {
            const fileName = `audio_${Date.now()}.webm`;
            const { error: uploadError } = await supabase.storage.from('media').upload(fileName, audioBlob);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('media').getPublicUrl(fileName);
            onSend(data.publicUrl, duration);

        } catch (error: any) {
            toast.error("Erro ao enviar áudio: " + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-4 bg-red-500/10 border border-red-500/20 rounded-xl p-2 animate-in slide-in-from-bottom-2 fade-in w-full">

            {/* Visualizer */}
            <div className="flex items-center gap-1 h-8 flex-1 justify-center px-4">
                {isRecording && volumeLevels.map((lvl, i) => (
                    <div
                        key={i}
                        className="w-1 bg-red-500 rounded-full transition-all duration-75"
                        style={{ height: `${lvl}%`, opacity: 0.5 + (lvl / 200) }}
                    />
                ))}
                {!isRecording && audioBlob && <div className="text-sm text-red-400 font-bold">Áudio gravado ({formatTime(duration)})</div>}
            </div>

            <div className="flex items-center gap-2">
                <div className="text-red-500 font-mono text-xs font-bold w-12 text-center">
                    {isRecording ? <span className="animate-pulse">● REC</span> : 'DONE'}
                </div>
                <div className="text-white font-mono text-xs w-12 text-center">
                    {formatTime(duration)}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={onCancel}
                    className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                >
                    <Trash2 size={16} />
                </button>

                {isRecording ? (
                    <button
                        onClick={handleStop}
                        className="p-2 bg-red-500 rounded-full hover:bg-red-600 text-white transition-colors shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                    >
                        <Square size={16} fill="currentColor" />
                    </button>
                ) : (
                    <button
                        onClick={handleUploadAndSend}
                        disabled={isUploading}
                        className="p-2 bg-emerald-500 rounded-full hover:bg-emerald-600 text-white transition-colors shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center justify-center"
                    >
                        {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    </button>
                )}
            </div>
        </div>
    );
};
