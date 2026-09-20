import { useEffect, useState } from "react";
import { subscribe, getState } from "@/lib/reactiveBus";

export default function MoodBand() {
  const [label, setLabel] = useState(() => getState().moodLabel);
  const [confidence, setConfidence] = useState(() => getState().moodConfidence);

  useEffect(
    () =>
      subscribe((state) => {
        setLabel((current) => (current !== state.moodLabel ? state.moodLabel : current));
        setConfidence((current) => (current !== state.moodConfidence ? state.moodConfidence : current));
      }),
    []
  );

  const pct = confidence == null ? 0 : Math.round(Number(confidence) * 100);

  return (
    <div className="ma-mood-band" data-testid="theater-mood" data-mood={label || ""} data-confidence={String(pct)}>
      <span className="ma-mood-key">Mood</span>
      <span className="ma-mood-value ma-emotion-text">{label || "listening"}</span>
      <span className="ma-mood-confidence ma-faint" aria-hidden="true">
        {pct}%
      </span>
    </div>
  );
}