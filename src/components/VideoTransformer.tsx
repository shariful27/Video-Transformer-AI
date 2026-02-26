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

    const video = videoRef.current;
    
    // Ensure video is loaded
    if (video.readyState < 2) {
      console.log("Video not ready, waiting...");
      await new Promise((resolve) => {
        video.onloadeddata = resolve;
      });
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error("Video dimensions are 0");
      return;
    }

    setIsProcessing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const canvasStream = canvas.captureStream(30); // 30 FPS is more stable
    const combinedStream = new MediaStream();
    
    // Advanced Audio Manipulation for Copyright Bypass
    let audioContext: AudioContext | null = null;

    try {
      const videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream ? (video as any).mozCaptureStream() : null;
      if (videoStream && videoStream.getAudioTracks().length > 0) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        await audioContext.resume();
        
        const mediaStreamSource = audioContext.createMediaStreamSource(videoStream);
        const mediaStreamDestination = audioContext.createMediaStreamDestination();

        if (antiCopyright) {
          // Subtle Phase/Frequency shift to bypass Audio Content ID
          const filter = audioContext.createBiquadFilter();
          filter.type = 'allpass';
          filter.frequency.value = 1000;
          
          const gain = audioContext.createGain();
          gain.gain.value = 0.99;

          mediaStreamSource.connect(filter);
          filter.connect(gain);
          gain.connect(mediaStreamDestination);
        } else {
          mediaStreamSource.connect(mediaStreamDestination);
        }
        
        combinedStream.addTrack(mediaStreamDestination.stream.getAudioTracks()[0]);
      }
    } catch (err) {
      console.warn("Advanced audio processing failed, falling back to raw audio", err);
      try {
        const videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream ? (video as any).mozCaptureStream() : null;
        if (videoStream && videoStream.getAudioTracks().length > 0) {
          combinedStream.addTrack(videoStream.getAudioTracks()[0]);
        }
      } catch (e) {}
    }

    combinedStream.addTrack(canvasStream.getVideoTracks()[0]);

    let mimeType = 'video/webm;codecs=vp9';
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      mimeType = 'video/webm;codecs=vp8';
    }

    let mediaRecorder: MediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8000000, // 8 Mbps is plenty for most social media
      });
    } catch (e) {
      console.error("MediaRecorder initialization failed", e);
      setIsProcessing(false);
      return;
    }

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      onComplete(blob);
      setIsProcessing(false);
      if (audioContext) audioContext.close();
    };

    video.currentTime = 0;
    video.playbackRate = antiCopyright ? 1.01 : 1.0;
    
    try {
      await video.play();
      mediaRecorder.start(1000); // Collect data every second
    } catch (e) {
      console.error("Failed to start recording", e);
      setIsProcessing(false);
      return;
    }

    const drawFrame = () => {
      if (video.paused || video.ended) {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        return;
      }

      if (onProgress && video.duration) {
        onProgress(Math.floor((video.currentTime / video.duration) * 100));
      }

      ctx.save();
      
      if (antiCopyright) {
        const time = Date.now() / 1000;
        const rShift = Math.sin(time) * 0.01;
        const gShift = Math.cos(time) * 0.01;
        ctx.filter = `${filter} hue-rotate(${rShift}deg) brightness(${1 + gShift})`;

        const scale = 1.01; // Slightly less aggressive scaling
        const jitterX = (Math.random() - 0.5) * 4;
        const jitterY = (Math.random() - 0.5) * 4;
        
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-canvas.width / 2 + jitterX, -canvas.height / 2 + jitterY);
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255}, 0.005)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.filter = filter;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      
      ctx.restore();

      if (watermarkText) {
        ctx.filter = 'none';
        ctx.font = 'bold 24px Inter';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(watermarkText, 30, canvas.height - 30);
      }

      setProgress((video.currentTime / video.duration) * 100);
      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  };

  // Auto-start if requested
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isProcessing && sourceUrl) {
        processVideo();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [sourceUrl]);

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
