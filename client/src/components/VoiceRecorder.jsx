import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, X, Play, Pause, AlertTriangle } from 'lucide-react';

/**
 * VoiceRecorder - Records audio using the browser's MediaRecorder API,
 * shows recording state with timer, and hands the recorded audio blob
 * to onSend (Chats uploads it via /api/uploads and broadcasts it).
 * Anonymous by design - no device details or personal info are ever read or sent.
 */
export default function VoiceRecorder({ open, onClose, onSend }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      stopRecording();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  const resetState = () => {
    stopRecording();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setStatus('idle');
    setError('');
    setDuration(0);
    setAudioUrl(null);
    setIsPlaying(false);
    setAudioDuration(0);
    setCurrentTime(0);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    setStatus('requesting');
    setError('');
    chunksRef.current = [];
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('unsupported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
      });
      streamRef.current = stream;
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        setStatus('preview');
        setDuration(0);
      };
      mediaRecorder.onerror = () => {
        setStatus('error');
        setError('Recording failed. Please try again.');
      };
      mediaRecorder.start(100);
      setStatus('live');
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(prev => prev + 1), 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      setStatus('error');
      const name = err && err.name ? err.name : '';
      if (err && err.message === 'unsupported' || name === 'TypeError') {
        setError('Voice recording is not supported in this browser.');
      } else if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError('Microphone permission denied. Please allow access in browser settings.');
      } else if (name === 'NotFoundError' || name === 'NotReadableError') {
        setError('No microphone found. Connect a microphone and try again.');
      } else {
        setError('Could not access the microphone. Please try again.');
      }
    }
  };

  const handleStopRecording = () => stopRecording();
  const handleCancel = () => { resetState(); onClose(); };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSend = async () => {
    if (!audioUrl) return;
    const response = await fetch(audioUrl);
    const blob = await response.blob();
    const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
    const file = new File([blob], `voice_message_${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
    await onSend(file);
    handleCancel();
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/40 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <Mic size={18} className="text-indigo-400" /> Voice Message
          </h3>
          <button type="button" onClick={handleCancel} className="p-1 text-slate-400 hover:text-slate-200">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 flex flex-col items-center gap-4 min-h-[200px] justify-center">
          {status === 'idle' && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-indigo-600/20 flex items-center justify-center mx-auto mb-4">
                <Mic size={36} className="text-indigo-400" />
              </div>
              <p className="text-slate-300 mb-4">Tap to start recording</p>
              <button type="button" onClick={startRecording} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-full font-semibold text-sm transition-all flex items-center gap-2 text-white">
                <Mic size={18} /> Start Recording
              </button>
            </div>
          )}
          {status === 'requesting' && (
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-slate-300">Requesting microphone...</p>
            </div>
          )}
          {status === 'live' && (
            <div className="text-center w-full">
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 font-medium">Recording</span>
              </div>
              <div className="w-24 h-24 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-4 relative">
                <div className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping" />
                <Mic size={40} className="text-red-400" />
              </div>
              <p className="text-2xl font-mono text-slate-100 mb-4">{formatTime(duration)}</p>
              <div className="flex items-center justify-center gap-3">
                <button type="button" onClick={handleStopRecording} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-full text-sm font-medium transition-all flex items-center gap-2 text-white">
                  <Square size={16} /> Stop
                </button>
                <button type="button" onClick={handleCancel} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-full text-sm font-medium transition-all flex items-center gap-2 text-slate-200">
                  <X size={16} /> Cancel
                </button>
              </div>
            </div>
          )}
          {status === 'preview' && (
            <div className="text-center w-full">
              <p className="text-sm text-slate-400 mb-3">Preview your voice message</p>
              <div className="bg-slate-800 rounded-xl p-4 mb-4">
                <audio ref={audioRef} src={audioUrl} onLoadedMetadata={() => audioRef.current && setAudioDuration(audioRef.current.duration)} onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)} onEnded={() => { setIsPlaying(false); setCurrentTime(0); }} className="hidden" />
                <div className="flex items-center gap-3">
                  <button type="button" onClick={togglePlayPause} className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center transition-colors shrink-0">
                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                  </button>
                  <div className="flex-1">
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: audioDuration ? `${(currentTime / audioDuration) * 100}%` : '0%' }} />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-slate-500">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(audioDuration)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button type="button" onClick={startRecording} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-full text-sm font-medium transition-all flex items-center gap-2 text-slate-200">
                  <Mic size={16} /> Re-record
                </button>
                <button type="button" onClick={handleSend} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-full font-semibold text-sm transition-all flex items-center gap-2 text-white">
                  <Send size={16} /> Send
                </button>
                <button type="button" onClick={handleCancel} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-full text-sm font-medium transition-all flex items-center gap-2 text-slate-200">
                  <X size={16} /> Cancel
                </button>
              </div>
            </div>
          )}
          {status === 'error' && (
            <div className="text-center">
              <AlertTriangle size={36} className="text-amber-400 mx-auto mb-3" />
              <p className="text-sm text-slate-200 max-w-xs mb-4">{error}</p>
              <div className="flex items-center justify-center gap-3">
                <button type="button" onClick={startRecording} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-full text-sm font-medium transition-all text-white">Try Again</button>
                <button type="button" onClick={handleCancel} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-full text-sm font-medium transition-all text-slate-200">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}