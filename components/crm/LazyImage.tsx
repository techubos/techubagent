import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
    src: string;
    alt: string;
    className?: string;
    onClick?: () => void;
}

export function LazyImage({ src, alt, className, onClick }: LazyImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const imgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Check if browser supports IntersectionObserver
        if (!('IntersectionObserver' in window)) {
            setIsInView(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            {
                rootMargin: '200px', // Load early (200px before coming into view) 
                threshold: 0.01
            }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={imgRef}
            className={`relative overflow-hidden cursor-pointer group ${className}`}
            onClick={onClick}
        >
            {/* Placeholder / Loading State */}
            {!isLoaded && (
                <div className="absolute inset-0 bg-zinc-800 animate-pulse flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin opacity-20" />
                </div>
            )}

            {/* Actual Image */}
            {isInView && (
                <img
                    src={src}
                    alt={alt}
                    onLoad={() => setIsLoaded(true)}
                    className={`w-full h-full object-cover transition-all duration-700 ease-in-out ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                        } group-hover:scale-105`}
                />
            )}
        </div>
    );
}
