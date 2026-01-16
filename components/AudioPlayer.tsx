import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, Download, Volume2, FastForward } from 'lucide-react'

interface AudioPlayerProps {
    audioUrl: string
    transcription?: string
    duration?: number
    onError?: (error: string) => void
}

export function AudioPlayer({
    audioUrl,
    transcription,
    duration,
    onError
}: AudioPlayerProps) {
    const [playing, setPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [totalDuration, setTotalDuration] = useState(duration || 0)
    const [playbackRate, setPlaybackRate] = useState(1)
    const audioRef = useRef<HTMLAudioElement>(null)

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
        const handleLoadedMetadata = () => {
            if (!duration || duration === 0) {
                setTotalDuration(audio.duration)
            }
        }
        const handleEnded = () => setPlaying(false)
        const handleError = (e: any) => {
            console.error('Erro no player:', e)
            onError?.('Falha ao carregar áudio')
        }

        audio.addEventListener('timeupdate', handleTimeUpdate)
        audio.addEventListener('loadedmetadata', handleLoadedMetadata)
        audio.addEventListener('ended', handleEnded)
        audio.addEventListener('error', handleError)

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate)
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
            audio.removeEventListener('ended', handleEnded)
            audio.removeEventListener('error', handleError)
        }
    }, [onError, duration])

    const togglePlay = () => {
        const audio = audioRef.current
        if (!audio) return

        if (playing) {
            audio.pause()
        } else {
            audio.play().catch(err => {
                console.error('Erro ao reproduzir:', err)
                onError?.('Erro ao reproduzir áudio')
            })
        }
        setPlaying(!playing)
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current
        if (!audio) return

        const newTime = parseFloat(e.target.value)
        audio.currentTime = newTime
        setCurrentTime(newTime)
    }

    const changeSpeed = () => {
        const speeds = [1, 1.5, 2]
        const currentIndex = speeds.indexOf(playbackRate)
        const nextSpeed = speeds[(currentIndex + 1) % speeds.length]

        if (audioRef.current) {
            audioRef.current.playbackRate = nextSpeed
        }
        setPlaybackRate(nextSpeed)
    }

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "0:00"
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const handleDownload = () => {
        const a = document.createElement('a')
        a.href = audioUrl
        a.download = `audio-${Date.now()}.ogg`
        a.target = "_blank"
        a.click()
    }

    return (
        <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-3 space-y-2 border border-zinc-200 dark:border-zinc-700/50 w-full max-w-sm">
            {/* Player Controls */}
            <div className="flex items-center gap-3">
                <button
                    onClick={togglePlay}
                    className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-sm"
                >
                    {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                </button>

                <div className="flex-1 space-y-1 min-w-0">
                    <input
                        type="range"
                        min="0"
                        max={totalDuration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1.5 bg-gray-300 dark:bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 dark:text-zinc-400 font-medium">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(totalDuration)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={changeSpeed}
                        className="px-1.5 py-1 text-[10px] font-bold bg-gray-200 dark:bg-zinc-700 dark:text-zinc-300 rounded hover:bg-gray-300 dark:hover:bg-zinc-600 transition min-w-[28px]"
                        title="Velocidade"
                    >
                        {playbackRate}x
                    </button>

                    <button
                        onClick={handleDownload}
                        className="p-2 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 transition"
                        title="Download"
                    >
                        <Download size={16} />
                    </button>
                </div>
            </div>

            {/* Transcrição */}
            {transcription && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-1">
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5 flex items-center gap-1">
                        <Volume2 size={10} /> Transcrição
                    </p>
                    <p className="text-xs text-gray-700 dark:text-zinc-300 leading-relaxed bg-white dark:bg-zinc-900/50 p-2 rounded border border-zinc-100 dark:border-zinc-800 italic">
                        "{transcription}"
                    </p>
                </div>
            )}

            {/* Audio Element (Hidden) */}
            <audio ref={audioRef} src={audioUrl} preload="metadata" />
        </div>
    )
}
