import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import NetInfo from "@react-native-community/netinfo";
import {
  matchResident,
  searchResidents,
  type ResidentMatch,
} from "@/features/package-intake/services/intakeApi";
import type { MatchView } from "@/features/package-intake/models/packageIntake.types";

type UseResidentMatchingOptions = {
  alive: RefObject<boolean>;
  manualPick: MutableRefObject<boolean>;
  societyId: string;
  tower: string;
  flat: string;
  name: string;
};

export function useResidentMatching({
  alive,
  manualPick,
  societyId,
  tower,
  flat,
  name,
}: UseResidentMatchingOptions) {
  const matchSeq = useRef(0);

  const [match, setMatch] = useState<MatchView>({ status: "idle" });
  const [selected, setSelected] = useState<ResidentMatch | null>(null);
  const [matchMode, setMatchMode] = useState("missing");
  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState<ResidentMatch[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (manualPick.current) return;
    if (!tower && !flat && !name) {
      setMatch({ status: "idle" });
      setSelected(null);
      return;
    }
    const seq = ++matchSeq.current;
    const timer = setTimeout(async () => {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        if (!alive.current || seq !== matchSeq.current) return;
        setMatch({ status: "missing" });
        setMatchMode("missing");
        setSelected(null);
        return;
      }
      setMatch({ status: "loading" });
      try {
        const result = await matchResident({ tower, flat, name, societyId });
        if (!alive.current || seq !== matchSeq.current) return;
        if (result.status === "matched" && result.matches[0]) {
          setSelected(result.matches[0]);
          setMatchMode("matched");
          setMatch({ status: "matched", resident: result.matches[0] });
        } else if (result.matches.length > 0) {
          setSelected(null);
          setMatchMode("ambiguous");
          setMatch({ status: "ambiguous", residents: result.matches });
        } else {
          setSelected(null);
          setMatchMode("missing");
          setMatch({ status: "missing" });
        }
      } catch (err) {
        if (!alive.current || seq !== matchSeq.current) return;
        setMatch({
          status: "error",
          message: err instanceof Error ? err.message : "Directory lookup failed",
        });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [alive, manualPick, societyId, tower, flat, name]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length < 1) {
        setSearchHits([]);
        return;
      }
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        if (alive.current) {
          setSearchHits([]);
          setSearching(false);
        }
        return;
      }
      setSearching(true);
      try {
        const hits = await searchResidents(query.trim(), societyId);
        if (alive.current) setSearchHits(hits);
      } catch {
        if (alive.current) setSearchHits([]);
      } finally {
        if (alive.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [alive, query, societyId]);

  function selectResident(resident: ResidentMatch) {
    manualPick.current = true;
    setSelected(resident);
    setMatchMode("manual");
    setMatch({ status: "matched", resident });
    setQuery("");
    setSearchHits([]);
  }

  function resetMatching() {
    manualPick.current = false;
    setSelected(null);
    setMatch({ status: "idle" });
    setMatchMode("missing");
    setQuery("");
    setSearchHits([]);
  }

  const ambiguous = match.status === "ambiguous" && !selected;

  return {
    match,
    selected,
    matchMode,
    query,
    searchHits,
    searching,
    ambiguous,
    setQuery,
    selectResident,
    resetMatching,
  };
}
