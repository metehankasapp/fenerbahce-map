"use client";

import { useEffect, useState } from "react";
import { getOrCreateDeviceToken } from "@/lib/device";
import { getSupabase } from "@/lib/supabase";

type VoteState = {
  communityId: string | null;
  count: number;
};

export function CommunityVote({ communityId, label }: { communityId: string; label: string }) {
  const [state, setState] = useState<VoteState>({ communityId: null, count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) {
          if (active) {
            setError("Anonim oturum oluşturulamadı.");
            setLoading(false);
          }
          return;
        }
      }

      const { data, error: requestError } = await supabase.functions.invoke("community-vote", {
        method: "GET",
        headers: { "x-device-token": getOrCreateDeviceToken() },
      });
      if (!active) return;
      if (requestError) setError("Oy bilgisi alınamadı.");
      else setState({ communityId: data?.communityId ?? null, count: data?.counts?.[communityId] ?? 0 });
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [communityId]);

  async function vote() {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase bağlantısı henüz yapılandırılmadı.");
      return;
    }

    setLoading(true);
    setError("");

    let { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      const { data, error: authError } = await supabase.auth.signInAnonymously();
      if (authError || !data.session) {
        setError("Anonim oturum oluşturulamadı.");
        setLoading(false);
        return;
      }
      sessionData = { session: data.session };
    }

    const { data, error: voteError } = await supabase.functions.invoke("community-vote", {
      body: { communityId },
      headers: { "x-device-token": getOrCreateDeviceToken() },
    });

    if (voteError) {
      console.error("Community vote failed", voteError);
      setError("Oy kaydedilemedi. Lütfen tekrar dene.");
    } else setState({ communityId: data.communityId, count: data.count });
    setLoading(false);
  }

  const configured = getSupabase() !== null;
  const votedHere = state.communityId === communityId;

  if (!configured) return null;

  return (
    <section className="community-vote">
      <div><strong>{state.count}</strong><span>oy kullanıldı</span></div>
      <button disabled={loading || Boolean(state.communityId)} onClick={vote}>
        {loading ? "Kontrol ediliyor…" : votedHere ? "Camian seçildi ✓" : state.communityId ? "Başka camia seçtin" : "Bu benim camiam"}
      </button>
      {error && <small role="alert">{error}</small>}
      {votedHere && <small>{label} seçimin bu cihaz için kaydedildi.</small>}
    </section>
  );
}
