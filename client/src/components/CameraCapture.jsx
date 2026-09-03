import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RotateCcw, Send, AlertTriangle } from 'lucide-react';

// Convert a canvas data-URL (image/jpeg) into a Blob for upload
function dataURLToBlob(dataURL) {

  const [meta, b64] = dataURL.split(',');
  const mime = (meta.match(/^data:([^;]+);/) || [])[1] || 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
  CameraCapture - opens the device camera the browser's getUserMedia,
  shows a live preview, lets the user capture + review a photo,
  then hands the resulting image blob to onSend (Chats uploads it via /api/uploads
   and broadcasts it through the existing socket chat attachment system).
  Anonymous by design - no device details or personal info are ever read or sent.
*/

export default function CameraCapture({ open, onClose, onSend }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | requesting | live | error
  const [error, setError] = useState('');
  const [captured, setCaptured] = useState(null);
  const [sending, setSending] = useState(false);


  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };


  const startCamera = async () => {
    setStatus('requesting');
    setError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('unsupported');
      }
      // Prefer rear camera on mobile; falls back to the available webcam on desktop
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus('live');
    } catch (err) {
      console.error('Camera access error:', err);
      setStatus('error');
      const name = err && err.name ? err.name : '';
      if (err && err.message === 'unsupported' || name === 'TypeError') {
        setError('Camera is not supported in this browser.). Please use a browser with camera support or try the file attachment button instead.');
      } else if (name === 'NotAllowedError' || name === 'SecurityError' || (err && err.message && err.message.toLowerCase().includes('permission'))) {
        setError('Camera permission denied.). Please allow camera access for this site in your browser settings, then try again.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError' || (err && err.message && err.message.toLowerCase().includes('camera'))) {
        setError('No camera was found on this device,, or it is being used by another app.). Unlock your camera and try again.');
      } else {
        setError('Could not access the camera.). Please try again.');
      }
    }
  };


  useEffect(() => {
    if (open) {
      setCaptured(null);
      setSending(false);
      setError('');
      setStatus('idle');
      startCamera();
    } else {
      stopStream();
    }
    return () => stopStream();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open]);


  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    // Downscale very large frames so uploads stay fast and within server limits
    const MAX_DIM = 1600;
    const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Draws the frame exactly as previewed (orientation-safe: no EXIF involved)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopStream();
    setCaptured(dataUrl);
    setStatus('idle');
  };


  const handleSend = async () => {
    if (!captured || sending) return;
    setSending(true);
    setError('');
    try {
      const blob = dataURLToBlob(captured);
      await onSend(blob);
      handleClose();
    } catch (err) {
      console.error('Camera photo send failed:', err);
      setError('Photo upload failed. Please check your connection and try again.');
      setSending(false);
    }
  };


  const handleClose = () => {
    stopStream();
    setCaptured(null);
    setSending(false);
    setError('');
    setStatus('idle');
    onClose();
  };


  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 font-semibold text-slate-100">
            <Camera size={20} className="text-indigo-400" /> Capture Photo
          </div>
          <button type="button" onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors" aria-label="Close camera">
            <X size={20} />
          </button>
        </div>

        {/* Live preview / captured preview */}
        {!captured ? (
          <div className="relative bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto max-h-[65vh] object-contain" />

            {status === 'requesting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-center p-6">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-300">Requesting camera permission...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-center p-8">
                <AlertTriangle size={36} className="text-amber-400" />
                <p className="text-sm text-slate-200 max-w-xs">{error}</p>
                <button type="button" onClick={startCamera} className="mt-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-medium transition-colors">
                  Try Again
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="relative bg-black">
            <img src={captured} alt="Captured photo preview" className="w-full h-auto max-h-[65vh] object-contain" />
            {sending && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Actions - live view */}
        {!captured && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-center gap-3 bg-slate-900/80 flex-wrap">
            <button type="button" onClick={capture} disabled={status !== 'live'} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-full font-semibold text-sm transition-all flex items-center gap-2 text-white">
              <Camera size={18} /> Capture Photo
            </button>
            <button type="button" onClick={handleClose} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-full text-sm font-medium transition-all flex items-center gap-2 text-slate-200">
              <X size={16} /> Cancel
            </button>
          </div>
        )}

        {/* Actions - captured preview */}
        {captured && (
          <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-3 bg-slate-900/80">
            {error && <p className="text-sm text-red-400 text-center w-full sm:order-none">{error}</p>}
            <button type="button" onClick={() => { setCaptured(null); setError(''); startCamera(); }} disabled={sending} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-full text-sm font-medium transition-all flex items-center gap-2 text-slate-200">
              <RotateCcw size={16} /> Retake
            </button>
            <button type="button" onClick={handleSend} disabled={sending} className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-full font-semibold text-sm transition-all flex items-center gap-2 text-white">
              {sending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
              {sending ? 'Sending...' : 'Send'}
            </button>
            <button type="button" onClick={handleClose} disabled={sending} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-full text-sm font-medium transition-all flex items-center gap-2 text-slate-200">
              <X size={16} /> Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}