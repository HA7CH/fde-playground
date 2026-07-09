"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BEST_SCORE_KEY, updateBestScore } from "@/lib/progress";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

type Completion = {
  completedAt: number;
  finalElapsedMs: number;
  finalGameMs: number;
  finalDay: number;
};

type Score = {
  user_id: string;
  github_login: string;
  display_name: string;
  avatar_url: string | null;
  best_elapsed_ms: number;
  final_day: number;
  completed_at: string;
};

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function readLocalBest(): { elapsedMs: number; completedAt: number; finalDay: number } | null {
  try {
    const raw = localStorage.getItem(BEST_SCORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalBest(completion: Completion) {
  const best = updateBestScore(readLocalBest(), {
    elapsedMs: completion.finalElapsedMs,
    completedAt: completion.completedAt,
    finalDay: completion.finalDay,
  });
  try {
    if (best) localStorage.setItem(BEST_SCORE_KEY, JSON.stringify(best));
  } catch {
    // 本机最好成绩只是降级展示，写失败不阻断通关。
  }
  return best;
}

export default function LeaderboardPanel({
  completion,
  foundCount,
  total,
}: {
  completion: Completion;
  foundCount: number;
  total: number;
}) {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [configured, setConfigured] = useState(true);
  const [status, setStatus] = useState("");
  const [localBest, setLocalBest] = useState(() => writeLocalBest(completion));

  async function loadScores() {
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      const body = await res.json();
      setConfigured(Boolean(body.configured));
      setScores(Array.isArray(body.scores) ? body.scores : []);
    } catch {
      setConfigured(false);
    }
  }

  useEffect(() => {
    setLocalBest(writeLocalBest(completion));
  }, [completion]);

  useEffect(() => {
    loadScores();
  }, []);

  useEffect(() => {
    if (!supabase) {
      setConfigured(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session || !configured) return;
    const accessToken = session.access_token;
    let cancelled = false;
    async function submit() {
      setStatus("提交成绩中…");
      try {
        const res = await fetch("/api/leaderboard/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            elapsedMs: completion.finalElapsedMs,
            finalGameMs: completion.finalGameMs,
            finalDay: completion.finalDay,
            completedAt: completion.completedAt,
            foundCount,
            total,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        if (!cancelled) {
          setStatus("成绩已同步");
          await loadScores();
        }
      } catch {
        if (!cancelled) setStatus("同步失败，稍后可刷新重试");
      }
    }
    submit();
    return () => {
      cancelled = true;
    };
  }, [session, configured, completion, foundCount, total]);

  const signIn = async () => {
    if (!supabase) {
      setStatus("部署时需要配置 Supabase GitHub 登录");
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.href },
    });
  };

  return (
    <div className="leaderboard-panel panel">
      <div className="leaderboard-head">🏁 通关榜</div>
      <div className="leaderboard-self">
        <b>{fmt(completion.finalElapsedMs)}</b>
        <span>第 {completion.finalDay} 天集齐 {foundCount}/{total}</span>
      </div>
      {!session && (
        <button className="btn btn-accent leaderboard-login" onClick={signIn}>
          GitHub 登录提交成绩
        </button>
      )}
      {status && <div className="leaderboard-status">{status}</div>}
      {!configured && (
        <div className="leaderboard-status">
          线上榜未配置，本机最好成绩：{localBest ? fmt(localBest.elapsedMs) : fmt(completion.finalElapsedMs)}
        </div>
      )}
      <div className="leaderboard-list">
        {scores.length ? scores.map((score, index) => (
          <div className="leaderboard-row" key={score.user_id}>
            <span className="rank">#{index + 1}</span>
            {score.avatar_url ? <img src={score.avatar_url} alt="" /> : <span className="leaderboard-avatar" />}
            <span className="who">{score.display_name || score.github_login}</span>
            <b>{fmt(score.best_elapsed_ms)}</b>
          </div>
        )) : (
          <div className="leaderboard-empty">还没人上榜，先把第一名拿下。</div>
        )}
      </div>
    </div>
  );
}
