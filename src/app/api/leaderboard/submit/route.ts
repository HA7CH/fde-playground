import { ALL_CLUES } from "@/lib/personas";
import { canSubmitScore, scoreBeatsExisting } from "@/lib/leaderboard";
import { getServiceClient } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitBody = {
  elapsedMs?: number;
  finalGameMs?: number;
  finalDay?: number;
  completedAt?: number;
  foundCount?: number;
  total?: number;
};

function readBearer(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export async function POST(req: Request) {
  const supabase = getServiceClient();
  if (!supabase) return Response.json({ error: "leaderboard not configured" }, { status: 503 });

  const token = readBearer(req);
  if (!token) return Response.json({ error: "login required" }, { status: 401 });

  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const total = ALL_CLUES.length;
  const elapsedMs = Number(body.elapsedMs);
  const foundCount = Number(body.foundCount);
  if (!canSubmitScore({ elapsedMs, foundCount, total }) || body.total !== total) {
    return Response.json({ error: "run is not complete" }, { status: 400 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return Response.json({ error: "invalid login" }, { status: 401 });

  const user = authData.user;
  const meta = user.user_metadata ?? {};
  const githubLogin = String(meta.user_name || meta.preferred_username || meta.name || user.email || "GitHub");
  const displayName = String(meta.full_name || meta.name || githubLogin);
  const avatarUrl = typeof meta.avatar_url === "string" ? meta.avatar_url : null;
  const completedAt = new Date(Number(body.completedAt) || Date.now()).toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("leaderboard_scores")
    .select("user_id, best_elapsed_ms")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) {
    console.error("[/api/leaderboard/submit] select", existingError.message);
    return Response.json({ error: "leaderboard unavailable" }, { status: 500 });
  }

  if (!scoreBeatsExisting(existing, elapsedMs)) {
    return Response.json({ ok: true, keptExisting: true });
  }

  const row = {
    user_id: user.id,
    github_login: githubLogin,
    display_name: displayName,
    avatar_url: avatarUrl,
    best_elapsed_ms: Math.floor(elapsedMs),
    final_game_ms: Math.floor(Number(body.finalGameMs) || 0),
    final_day: Math.floor(Number(body.finalDay) || 1),
    completed_at: completedAt,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("leaderboard_scores").upsert(row, { onConflict: "user_id" });
  if (error) {
    console.error("[/api/leaderboard/submit] upsert", error.message);
    return Response.json({ error: "score submit failed" }, { status: 500 });
  }

  return Response.json({ ok: true, keptExisting: false });
}
