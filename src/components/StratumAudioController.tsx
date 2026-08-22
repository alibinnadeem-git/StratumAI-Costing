"use client";

import { Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const NORMAL_VOLUME = 0.20;
const DUCKED_VOLUME = 0.035;

export default function StratumAudioController() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = NORMAL_VOLUME;
    audio.loop = true;

    const tryPlay = async () => {
      if (!playing || muted) return;
      try { await audio.play(); setNeedsGesture(false); }
      catch { setNeedsGesture(true); }
    };
    void tryPlay();

    const unlock = () => { void tryPlay(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const duck = () => { audio.volume = DUCKED_VOLUME; };
    const restore = () => { audio.volume = NORMAL_VOLUME; };
    window.addEventListener("stratum-voice-start", duck as EventListener);
    window.addEventListener("stratum-voice-end", restore as EventListener);
    return () => {
      window.removeEventListener("stratum-voice-start", duck as EventListener);
      window.removeEventListener("stratum-voice-end", restore as EventListener);
    };
  }, [playing, muted]);

  async function togglePlay() {
    const audio = audioRef.current; if (!audio) return;
    if (audio.paused) { setPlaying(true); setMuted(false); try { await audio.play(); setNeedsGesture(false); } catch { setNeedsGesture(true); } }
    else { audio.pause(); setPlaying(false); }
  }

  function toggleMute() {
    const audio = audioRef.current; if (!audio) return;
    audio.muted = !audio.muted; setMuted(audio.muted);
  }

  return <div className="fixed bottom-14 left-4 z-[72] flex items-center gap-1 border border-[#1C3A57] bg-[#0B1F32]/95 p-1 shadow-xl backdrop-blur sm:left-6">
    <audio ref={audioRef} src="/audio/stratum-background.mp3" preload="auto" />
    <span className="hidden items-center gap-1 px-2 font-mono text-[9px] uppercase tracking-[.07em] text-[#6FD6C9] sm:flex"><Music2 className="h-3.5 w-3.5"/> Soundtrack</span>
    <button type="button" onClick={togglePlay} className="flex h-8 w-8 items-center justify-center border border-[#1C3A57] text-[#DCEBF5] hover:border-[#C97C3D] hover:text-[#E0954F]" aria-label={playing?"Pause background music":"Play background music"}>{playing?<Pause className="h-3.5 w-3.5"/>:<Play className="h-3.5 w-3.5"/>}</button>
    <button type="button" onClick={toggleMute} className="flex h-8 w-8 items-center justify-center border border-[#1C3A57] text-[#DCEBF5] hover:border-[#C97C3D] hover:text-[#E0954F]" aria-label={muted?"Unmute background music":"Mute background music"}>{muted?<VolumeX className="h-3.5 w-3.5"/>:<Volume2 className="h-3.5 w-3.5"/>}</button>
    {needsGesture && <span className="hidden px-2 font-mono text-[8px] text-[#E8B339] lg:inline">CLICK ONCE TO ENABLE AUDIO</span>}
  </div>;
}
