import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-device-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = request.headers.get("x-device-token") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return json({ error: "invalid_device" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const deviceHash = await sha256(token);

  const { data: countsRows, error: countsError } = await admin
    .from("community_vote_counts")
    .select("community_id,vote_count");
  if (countsError) return json({ error: "storage_error" }, 500);

  const counts = countsRows.reduce<Record<string, number>>((result, row) => {
    result[row.community_id] = Number(row.vote_count);
    return result;
  }, {});

  const { data: existingRows, error: existingError } = await admin
    .from("community_votes")
    .select("community_id")
    .eq("device_hash", deviceHash);
  if (existingError) return json({ error: "storage_error" }, 500);

  const communityIds = existingRows.map((row) => row.community_id);

  if (request.method === "GET") return json({ communityIds, counts });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  const jwt = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const { data: { user }, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !user || !user.is_anonymous) return json({ error: "anonymous_auth_required" }, 401);

  const body = await request.json().catch(() => null) as { communityId?: unknown } | null;
  const communityId = typeof body?.communityId === "string" ? body.communityId : "";
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(communityId)) return json({ error: "invalid_community" }, 400);

  const { error: installationError } = await admin.from("device_installations").insert({
    device_hash: deviceHash,
    auth_user_id: user.id,
  });
  if (installationError && installationError.code !== "23505") return json({ error: "storage_error" }, 500);

  const { data: installation } = await admin
    .from("device_installations")
    .select("auth_user_id")
    .eq("device_hash", deviceHash)
    .single();
  if (installation?.auth_user_id !== user.id) return json({ error: "device_session_mismatch" }, 409);

  const { error: voteError } = await admin.from("community_votes").insert({ device_hash: deviceHash, community_id: communityId });
  if (voteError?.code === "23505") return json({ error: "already_voted", communityId }, 409);
  if (voteError) return json({ error: "storage_error" }, 500);

  return json({ communityId, count: (counts[communityId] ?? 0) + 1 }, 201);
});
