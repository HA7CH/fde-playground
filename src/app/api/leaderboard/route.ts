import { getServiceClient } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) {
    return Response.json({ configured: false, scores: [] });
  }

  const { data, error } = await supabase
    .from("leaderboard_scores")
    .select("user_id, github_login, display_name, avatar_url, best_elapsed_ms, final_day, completed_at, updated_at")
    .order("best_elapsed_ms", { ascending: true })
    .order("completed_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[/api/leaderboard]", error.message);
    return Response.json({ configured: true, scores: [], error: "leaderboard unavailable" }, { status: 500 });
  }

  return Response.json({ configured: true, scores: data ?? [] });
}
