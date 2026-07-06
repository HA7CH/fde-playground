"use client";

import { useSyncExternalStore } from "react";
import { isMuted, toggleMute, subscribeMute } from "@/lib/sfx";

/** 音效开关（🔊/🔇）。状态存 localStorage，全站共享。 */
export default function SoundToggle({ className = "sound-toggle" }: { className?: string }) {
  const muted = useSyncExternalStore(subscribeMute, isMuted, () => false);
  return (
    <button
      className={className}
      onClick={toggleMute}
      title={muted ? "开启音效" : "静音"}
      aria-label={muted ? "开启音效" : "静音"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
