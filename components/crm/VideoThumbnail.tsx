import React, { useState } from 'react';
import { Play, Maximize2 } from 'lucide-react';
import { LazyImage } from './LazyImage';

interface VideoThumbnailProps {
    videoUrl: string;
    thumbnailUrl?: string;
    className?: string;
}

export function VideoThumbnail({ videoUrl, thumbnailUrl, className }: VideoThumbnailProps) {
    const [showFullVideo, setShowFullVideo] = useState(false);

    if (showFullVideo) {
        return (
            <div className={`relative rounded-xl overflow-hidden border border-white/10 bg-black ${className}`}>
                <video
                    src={videoUrl}
                    controls
                    autoPlay
                    className="w-full h-full"
                />
                <button
                    onClick={() => setShowFullVideo(false)}
                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all"
                >
                    <Maximize2 size={16} />
                </button>
            </div>
        );
    }

    return (
        <div
            className={`relative group cursor-pointer overflow-hidden rounded-xl border border-white/10 ${className}`}
            onClick={() => setShowFullVideo(true)}
        >
            <LazyImage
                src={thumbnailUrl || videoUrl} // If no thumb, LazyImage might fail but we handle it
                alt="Video Preview"
                className="w-full h-full"
            />

            {/* Play Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-100 transition-opacity group-hover:bg-black/20">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-zinc-950 shadow-2xl scale-100 group-hover:scale-110 transition-transform">
                    <Play size={32} fill="currentColor" className="ml-1" />
                </div>
            </div>

            {/* Video Indicator */}
            <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[10px] font-black text-white uppercase tracking-widest border border-white/10">
                Video
            </div>
        </div>
    );
}
