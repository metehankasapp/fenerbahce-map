"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mapNodes } from "@/data/fenerbahce-map";
import { getOrCreateDeviceToken } from "@/lib/device";
import { getSupabase } from "@/lib/supabase";

type Counts = Record<string, number>;

export function VoteLeaderboard() {
  const [counts, setCounts] = useState<Counts>({});
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) return;
    }

    const { data, error } = await supabase.functions.invoke("community-vote", {
      method: "GET",
      headers: { "x-device-token": getOrCreateDeviceToken() },
    });
    if (!error) setCounts(data?.counts ?? {});
  }, []);

  useEffect(() => {
    void load();
    const update = (event: Event) => {
      const { communityId, count } = (event as CustomEvent<{ communityId: string; count: number }>).detail;
      setCounts((current) => ({ ...current, [communityId]: count }));
    };
    window.addEventListener("community-vote-updated", update);
    return () => window.removeEventListener("community-vote-updated", update);
  }, [load]);

  const ranking = useMemo(() => mapNodes
    .filter((node) => node.category !== "root" && counts[node.id])
    .map((node) => ({ ...node, votes: counts[node.id] }))
    .sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label, "tr")), [counts]);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  function focusCamia(communityId: string) {
    window.dispatchEvent(new CustomEvent("camia-focus", { detail: communityId }));
    setOpen(false);
  }

  return <div className="vote-leaderboard">
    <button className="ranking-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <b>{total}</b><span>oy · sıralama</span>
    </button>
    {open && <section className="ranking-panel">
      <header><h2>Camia sıralaması</h2><button onClick={() => setOpen(false)} aria-label="Kapat">×</button></header>
      {ranking.length ? <ol>{ranking.map((node, index) => <li key={node.id}><button onClick={() => focusCamia(node.id)}><i>{index + 1}</i><span>{node.label}</span><b>{node.votes}</b></button></li>)}</ol> : <p>Henüz oy kullanılmadı.</p>}
    </section>}
  </div>;
}
