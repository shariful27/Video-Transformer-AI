import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Save, RefreshCw, Wand2 } from 'lucide-react';

interface VideoTransformerProps {
  sourceUrl: string;
  voiceoverAudio?: string; // base64
  filter: string;
  watermarkText?: string;
  antiCopyright?: boolean;
  onComplete: (blob: Blob) => void;
  onProgress?: (progress: number) => void;
}

export const VideoTransformer: React.FC<VideoTransformerProps> = ({
  sourceUrl,
  voiceoverAudio,
  filter,
  watermarkText,
  antiCopyright,
  onComplete,
  onProgress,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const processVideo = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsProcessing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const canvasStream = canvas.captureStream(30);
    const combinedStream = new MediaStream(canvasStream.getVideoTracks());
    
    try {
      const videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream ? (video as any).mozCaptureStream() : null;
      if (videoStream) {
        const audioTracks = videoStream.getAudioTracks();
        if (audioTracks.length > 0) {
          combinedStream.addTrack(audioTracks[0]);
        }
      }
    } catch (err) {
      console.warn("Could not capture audio", err);
    }

    let mimeType = 'video/webm;codecs=vp9';
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
      mimeType = 'video/webm;codecs=h264';
    }

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 8000000, // 8 Mbps for high quality
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      onComplete(blob);
      setIsProcessing(false);
    };

    video.currentTime = 0;
    video.playbackRate = 1.0; // Natural speed
    await video.play();
    mediaRecorder.start();

    const drawFrame = () => {
      if (video.paused || video.ended) {
        mediaRecorder.stop();
        return;
      }

      if (onProgress && video.duration) {
        onProgress(Math.floor((video.currentTime / video.duration) * 100));
      }

      ctx.save();
      
      // Apply filter
      ctx.filter = filter;
      
      if (antiCopyright) {
        // Micro-cropping/Temporal Jitter: Randomly shift the source image by 1-2 pixels
        const offsetX = (Math.random() - 0.5) * 4;
        const offsetY = (Math.random() - 0.5) * 4;
        ctx.drawImage(video, offsetX, offsetY, canvas.width, canvas.height);
        
        // Inject invisible anti-tracking noise/code
        // Very subtle noise
        ctx.fillStyle = `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.01)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Digital Fingerprint Grid: A grid of semi-transparent pixels that encodes unique session data
        const gridSize = 16;
        for (let x = 0; x < canvas.width; x += gridSize) {
          for (let y = 0; y < canvas.height; y += gridSize) {
            if (Math.random() > 0.95) {
              ctx.fillStyle = `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.005)`;
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
        
        // Add invisible metadata text (drawn with 1% opacity)
        ctx.fillStyle = 'rgba(0,0,0,0.01)';
        ctx.font = '10px Arial';
        ctx.fillText(`ID:${Date.now()}-${Math.random()}`, Math.random() * canvas.width, Math.random() * canvas.height);
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      
      ctx.restore();

      // Apply watermark
      if (watermarkText) {
        ctx.filter = 'none';
        ctx.font = '24px Inter';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(watermarkText, 20, canvas.height - 20);
      }

      setProgress((video.currentTime / video.duration) * 100);
      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl">
        <video
          ref={videoRef}
          src={sourceUrl}
          className="hidden"
          crossOrigin="anonymous"
        />
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
        />
        
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
            <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
            <div className="text-white font-medium">Transforming Video...</div>
            <div className="w-64 h-2 bg-white/20 rounded-full mt-4 overflow-hidden">
              <div 
                className="h-full bg-emerald-400 transition-all duration-300" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <button
        onClick={processVideo}
        disabled={isProcessing}
        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg shadow-emerald-500/20"
      >
        <Wand2 className="w-5 h-5" />
        {isProcessing ? 'Processing...' : 'Start Transformation'}
      </button>
    </div>
  );
};
