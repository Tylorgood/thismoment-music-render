import { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { GENRES } from "@/lib/promptEngine";
import {
  BEGINNING_OPTIONS,
  ENDING_OPTIONS,
  ENERGY_OPTIONS,
  JOURNEY_OPTIONS,
  intentToBlueprint,
} from "@/lib/userIntentToBlueprint";
import { ARCHETYPE_NAMES, ARCHETYPE_TAGLINES } from "@/lib/promptEngine";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function ChoiceGrid({ options, value, onPick, labelOf }) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {options.map((option) => {
        const selected = labelOf(option) === value;
        return (
          <button
            key={option.id || option.id}
            onClick={() => onPick(option)}
            className={cx(
              "rounded-md border p-3 text-left text-sm transition-colors",
              selected
                ? "border-[#d4af37]/50 bg-[#d4af37]/10 text-stone-100"
                : "border-white/10 bg-black/20 text-stone-300 hover:border-white/25"
            )}
          >
            {labelOf(option)}
          </button>
        );
      })}
    </div>
  );
}

const STEPS = [
  "Basics",
  "The idea",
  "Where it starts",
  "The journey",
  "The ending",
  "The sound",
  "Review & build",
];

export default function AlbumWizard({ onLaunch }) {
  const [name, setName] = useState("");
  const [trackCount, setTrackCount] = useState(10);
  const [theme, setTheme] = useState("");
  const [beginning, setBeginning] = useState(BEGINNING_OPTIONS[0]);
  const [journey, setJourney] = useState(JOURNEY_OPTIONS[0]);
  const [ending, setEnding] = useState(ENDING_OPTIONS[0]);
  const [genre, setGenre] = useState(GENRES[0].id);
  const [energy, setEnergy] = useState(ENERGY_OPTIONS[1]);
  const [freeText, setFreeText] = useState("");
  const [step, setStep] = useState(0);

  const canAdvance = () => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return theme.trim().length > 0;
      default:
        return true;
    }
  };

  const build = () => {
    const intent = intentToBlueprint({
      theme,
      albumName: name.trim() || "Untitled Album",
      genre,
      trackCount,
      beginSeed: beginning.seed,
      beginWords: beginning.words,
      endSeed: ending.seed,
      endWords: ending.words,
      journey,
      energySeed: energy.words,
      freeText,
    });
    onLaunch(intent);
    toast.success("Album built — opening the studio with your dna");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <Wand2 className="h-5 w-5 text-[#d4af37]" />
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#d4af37]">Make Me an Album</p>
          <p className="text-sm text-stone-400">
            Answer seven questions. The engine turns them into an album DNA blend — no prompt
            engineering needed.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={cx(
              "h-1.5 flex-1 rounded-full",
              i <= step ? "bg-[#d4af37]" : "bg-white/10"
            )}
            title={label}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-stone-500">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>

      <div className="mt-4 rounded-lg border border-white/10 bg-[#11100f] p-5">
        {step === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs text-stone-400">
              Album name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Untitled Album"
                className="mt-1 w-full rounded-md border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-[#d4af37]"
              />
            </label>
            <label className="text-xs text-stone-400">
              Track count
              <input
                type="number"
                min={6}
                max={14}
                value={trackCount}
                onChange={(e) => setTrackCount(Number(e.target.value) || 10)}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-[#d4af37]"
              />
            </label>
            <p className="text-xs text-stone-500 md:col-span-2">
              Recommended 9–14 for a full arc. Between 6 and 14, the engine reshapes the journey
              to fit.
            </p>
          </div>
        )}

        {step === 1 && (
          <label className="block text-xs text-stone-400">
            What is this record about? (a scene, a feeling, a story)
            <textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              rows={4}
              placeholder="e.g. the last drive of the night through a city going dark — windows lit, no words left"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-[#d4af37]"
            />
            <p className="mt-1 text-stone-500">
              This becomes the album's narrative, runs through every track's anchor lines, and
              conditions the track titles.
            </p>
          </label>
        )}

        {step === 2 && (
          <>
            <p className="text-sm font-medium text-stone-300">Where does the record start?</p>
            <div className="mt-3">
              <ChoiceGrid
                options={BEGINNING_OPTIONS}
                value={beginning.id}
                onPick={(o) => setBeginning(o)}
                labelOf={(o) => o.label}
              />
            </div>
            <p className="mt-2 text-xs text-stone-500">
              A starting coordinate only — the arc decides how the album moves from there.
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm font-medium text-stone-300">How does it get there?</p>
            <div className="mt-3">
              <ChoiceGrid
                options={JOURNEY_OPTIONS}
                value={journey.id}
                onPick={(o) => setJourney(o)}
                labelOf={(o) => `${o.label}`}
              />
            </div>
            <p className="mt-2 text-xs text-stone-500">This sets the climax position on the album arc.</p>
          </>
        )}

        {step === 4 && (
          <>
            <p className="text-sm font-medium text-stone-300">Where does it end up?</p>
            <div className="mt-3">
              <ChoiceGrid
                options={ENDING_OPTIONS}
                value={ending.id}
                onPick={(o) => setEnding(o)}
                labelOf={(o) => o.label}
              />
            </div>
            <p className="mt-2 text-xs text-stone-500">
              An ending coordinate — the final one or two tracks lean toward it, while the closer
              still resolves the album's own arc.
            </p>
          </>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <label className="block text-xs text-stone-400">
              Genre
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-[#d4af37]"
              >
                {GENRES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="text-sm font-medium text-stone-300">Energy level</p>
              <div className="mt-2">
                <ChoiceGrid
                  options={ENERGY_OPTIONS}
                  value={energy.id}
                  onPick={(o) => setEnergy(o)}
                  labelOf={(o) => o.label}
                />
              </div>
            </div>
            <label className="block text-xs text-stone-400">
              Extra adjectives (optional) — words like "cinematic", "urgent", "intimate"
              <input
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="e.g. cinematic, uneasy, warm"
                className="mt-1 w-full rounded-md border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-[#d4af37]"
              />
            </label>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-stone-300">Review</p>
            {(() => {
              const intent = intentToBlueprint({
                theme,
                albumName: name.trim() || "Untitled Album",
                genre,
                trackCount,
                beginSeed: beginning.seed,
                beginWords: beginning.words,
                endSeed: ending.seed,
                endWords: ending.words,
                journey,
                energySeed: energy.words,
                freeText,
              });
              const lead = intent.archetypeWeights.indexOf(Math.max(...intent.archetypeWeights));
              return (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-sm text-stone-200">
                      <strong>{intent.album.name}</strong> · {GENRES.find((g) => g.id === genre)?.label} ·{" "}
                      {intent.album.trackCount} tracks
                    </span>
                    <span className="rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-1 text-xs text-[#f1d574]">
                      leans {ARCHETYPE_NAMES[lead]} — {ARCHETYPE_TAGLINES[lead]}
                    </span>
                  </div>
                  <p className="text-sm text-stone-300">{intent.theme || "No narrative yet."}</p>
                  {intent.directionSummary.map((line) => (
                    <p key={line} className="text-xs text-stone-400">
                      · {line}
                    </p>
                  ))}
                  <p className="text-xs text-stone-500">
                    Clarity {Math.round(intent.confidence * 100)}% · matched{" "}
                    {intent.matchedWords.join(", ") || "none (defaults hold)"}
                  </p>
                  <button
                    onClick={build}
                    className="inline-flex items-center gap-2 rounded-md border border-[#d4af37]/40 bg-[#d4af37] px-4 py-2 text-sm font-medium text-black hover:bg-[#e8c14a]"
                  >
                    <Sparkles className="h-4 w-4" />
                    Build my album
                  </button>
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            disabled={!canAdvance()}
            onClick={() => canAdvance() && setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="inline-flex items-center gap-2 rounded-md border border-[#d4af37]/40 bg-[#d4af37] px-4 py-2 text-sm font-medium text-black hover:bg-[#e8c14a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}