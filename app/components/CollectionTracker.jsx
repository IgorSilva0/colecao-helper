"use client";

import { useState, useMemo } from "react";
import { POWER_TABLE, STAT_MAP } from "./poder";

const DEFENSIVE_STATS = new Set([
  "HP", "Defesa", "Evasão", "Bloqueio", "Redução de Danos",
  "Ignorar Acerto", "Ignorar Perfuração",
  "Desfazer Ign. Redução de Dano",
  "Resistência ao Dano Crítico", "Resistência à Imobilidade",
  "Resistência à Queda", "Resistência à Investida",
  "Resistência ao Atordoamento", "Resistência à Técnica Amp",
  "PVE Defesa", "PVP Defesa", "PVE Evasão", "PVP Redução de Dano",
  "PVE Ignorar Perfuração", "PVE Ignorar Acerto",
  "PVE Redução de Danos", "PVE Canc. Ig. Red Dano",
]);

const OFFENSIVE_STATS = new Set([
  "Precisão", "Danos Críticos", "Acerto", "Perfuração",
  "Ignorar Bloqueio", "Ignorar Redução de Dano",
  "Dano Adicional", "Aumentou todos os ataques",
  "Aumentou todas as técnicas Amp.", "Ign Res Taxa Crítica",
  "Ignorar Resistência a Danos Críticos", "Ignorar Resistência à Técnica Amp",
  "Aum. Dano Ataque Norm", "Cancelar Ignorar Perfuração",
  "PVE Todas as Técnicas Amp", "PVE Dano Crítico", "PVE Perfuração",
  "PVE Todos os Ataques", "PVE Precisão", "PVE Adicionar Dano",
  "PVE Dano de Ataque Normal UP", "PVP Dano Adicionado", "PVE Ignorar Bloqueio",
  "FOR", "INT", "DES",
]);

function getStatName(description) {
  return description.replace(/[\s+\d%.]+$/, "").trim();
}

function getCollectionType(collection) {
  let isDefensive = false;
  let isOffensive = false;
  for (const r of collection.rewards) {
    const stat = getStatName(r.description);
    if (DEFENSIVE_STATS.has(stat)) isDefensive = true;
    if (OFFENSIVE_STATS.has(stat)) isOffensive = true;
  }
  if (isOffensive) return "offensive";
  if (isDefensive) return "defensive";
  return "offensive";
}

function calcIncremental(group) {
  const v0 = group[0]?.value ?? 0;
  const v1 = group[1]?.value ?? 0;
  const v2 = group[2]?.value ?? 0;
  return [v0, v1 - v0, v2 - v1];
}

const MILESTONE_PCT = [30, 60, 100];
const MILESTONE_LABELS = ["30%", "60%", "100%"];

function parseStatLine(str) {
  const match = str.match(/^(.+?)\s+\+?([\d.]+)%?$/);
  if (!match) return null;
  return { stat: match[1].trim(), value: parseFloat(match[2]) };
}

function RewardMilestones({ rewards, progress }) {
  const groups = useMemo(() => {
    const map = new Map();
    rewards.forEach(r => {
      if (!map.has(r.force)) map.set(r.force, []);
      map.get(r.force).push(r);
      map.get(r.force).sort((a, b) => a.force - b.force);
    });
    return [...map.values()];
  }, [rewards]);

  const pendingGroups = groups.filter(g =>
    g.some((_, i) => progress < MILESTONE_PCT[i])
  );

  if (!pendingGroups.length) return null;

  return (
    <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Recompensas Pendentes</p>
      {pendingGroups.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-1.5">
          <div className="relative h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
            {group.map((r, i) => {
              const pct = MILESTONE_PCT[i];
              const claimed = progress >= pct;
              return (
                <div
                  key={i}
                  className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-colors ${
                    claimed
                      ? "bg-green-400 border-green-500"
                      : "bg-zinc-300 dark:bg-zinc-600 border-zinc-400 dark:border-zinc-500"
                  }`}
                  style={{ left: `calc(${pct}% - 6px)` }}
                />
              );
            })}
          </div>
          <div className="flex justify-between">
            {group.map((r, i) => {
              const pct = MILESTONE_PCT[i];
              const claimed = progress >= pct;
              const isNext = !claimed && (i === 0 || progress >= MILESTONE_PCT[i - 1]);
              const inc = calcIncremental(group);
              return (
                <div key={i} className="flex flex-col items-center gap-0.5" style={{ width: "33%" }}>
                  <span className="text-[10px] text-zinc-400">{MILESTONE_LABELS[i]}</span>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md text-center leading-tight ${
                    claimed
                      ? "text-zinc-400 dark:text-zinc-500 line-through"
                      : isNext
                      ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}>
                    {claimed ? "✓" : `+${inc[i]}`}
                  </span>
                  {!claimed && (
                    <span className="text-[10px] text-zinc-400 truncate max-w-full text-center">
                      {r.description.replace(/[+\d%.]+$/, "").trim()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CollectionCard({ collection: c }) {
  const pct = Math.round(c.progress);
  const type = getCollectionType(c);

  const remainingRewards = useMemo(() => {
    const map = new Map();
    const byForce = new Map();
    c.rewards.forEach(r => {
      if (!byForce.has(r.force)) byForce.set(r.force, []);
      byForce.get(r.force).push(r);
    });
    byForce.forEach(group => {
      const inc = calcIncremental(group);
      group.forEach((r, idx) => {
        if (pct >= MILESTONE_PCT[idx]) return;
        const stat = getStatName(r.description);
        map.set(stat, (map.get(stat) ?? 0) + inc[idx]);
      });
    });
    return [...map.entries()];
  }, [c.rewards, pct]);

  function getPower(stat) {
    const normalized = STAT_MAP[stat] ?? stat.replace(/^(PVE |PVP )/, "").trim();
    return POWER_TABLE[normalized] ?? 0;
  }

  const totalPower = remainingRewards.reduce((acc, [stat, total]) => {
    return acc + total * getPower(stat);
  }, 0);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{type === "offensive" ? "⚔️" : "🛡️"}</span>
          <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-100 truncate">{c.name}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
          pct === 0
            ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            : "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
        }`}>
          {pct}% – <span className="text-emerald-600 dark:text-emerald-400">{totalPower.toLocaleString()} 💥</span>
        </span>
      </div>

      <div className="h-1 bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      <RewardMilestones rewards={c.rewards} progress={pct} />

      <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
        {c.missions.map(mission => {
          const missing = mission.data.filter(i => !i.done);
          if (!missing.length) return null;
          return (
            <div key={mission.id} className="px-4 py-2">
              {mission.name && (
                <p className="text-xs text-zinc-400 italic mb-2">{mission.name}</p>
              )}
              <div className="flex flex-col gap-1.5">
                {missing.map((item, i) => {
                  const itemPct = item.max > 0 ? (item.progress / item.max) * 100 : 0;
                  const isPartial = item.progress > 0;
                  return (
                    <div key={i} className={`flex items-center gap-2.5 p-2 rounded-lg ${
                      isPartial ? "bg-orange-50 dark:bg-orange-950/20" : "bg-red-50 dark:bg-red-950/20"
                    }`}>
                      <div className="flex justify-center items-center size-10 overflow-hidden relative rounded-lg border border-white/10 bg-white/5 shrink-0">
                        <div
                          className="absolute bg-center bg-no-repeat bg-cover pointer-events-none size-[60px]"
                          style={{
                            backgroundImage: `url("${item.imageUrl}")`,
                            left: "50%", top: "50%",
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-700 dark:text-zinc-200 truncate">{item.name}</p>
                        <p className="text-xs text-zinc-400">
                          <span className={isPartial ? "text-orange-500 font-semibold" : "text-red-500 font-semibold"}>
                            {item.progress.toLocaleString()}
                          </span>
                          {" / "}
                          {item.max.toLocaleString()}
                        </p>
                      </div>
                      <div className="w-10 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full shrink-0">
                        <div
                          className={`h-full rounded-full ${isPartial ? "bg-orange-400" : "bg-red-400"}`}
                          style={{ width: `${Math.min(itemPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {remainingRewards.length > 0 && (
        <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">Ainda a ganhar</p>
          <div className="flex flex-wrap gap-2">
            {remainingRewards.map(([stat, total]) => (
              <div key={stat} className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{stat}</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+{total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CollectionTracker() {
  const [character, setCharacter] = useState(null);
  const [inputName, setInputName] = useState("");
  const [data, setData] = useState(null);
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("progress");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [showTotalPower, setShowTotalPower] = useState(false);

  async function fetchData(name) {
    setLoading(true);
    setError(null);
    setCharacter(null);
    setValues(null);
    try {
      const res = await fetch(`https://neo-scraper-production-9b11.up.railway.app/collection?name=${encodeURIComponent(name)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);

      // Find the payload that has data + values
      const payload = Object.values(json).find(v => v?.data && v?.values) ?? json;

      setCharacter(payload.character || null);
      setData(payload.data || []);
      setValues(payload.values || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (inputName.trim()) fetchData(inputName.trim());
  }

  function getRemainingPower(collection) {
    const pct = Math.round(collection.progress);
    const map = new Map();
    const byForce = new Map();
    collection.rewards.forEach(r => {
      if (!byForce.has(r.force)) byForce.set(r.force, []);
      byForce.get(r.force).push(r);
    });
    byForce.forEach(group => {
      const inc = calcIncremental(group);
      group.forEach((r, idx) => {
        if (pct >= MILESTONE_PCT[idx]) return;
        const stat = getStatName(r.description);
        const normalized = STAT_MAP[stat] ?? stat.replace(/^(PVE |PVP )/, "").trim();
        map.set(normalized, (map.get(normalized) ?? 0) + inc[idx]);
      });
    });
    return [...map.entries()].reduce((acc, [stat, total]) => {
      return acc + total * (POWER_TABLE[stat] ?? 0);
    }, 0);
  }

  // Power already earned from completed milestones
  const earnedCollectionPower = useMemo(() => {
    if (!data) return 0;
    return data.reduce((catAcc, cat) => {
      return catAcc + cat.collections.reduce((colAcc, c) => {
        const byForce = new Map();
        c.rewards.forEach(r => {
          if (!byForce.has(r.force)) byForce.set(r.force, []);
          byForce.get(r.force).push(r);
        });
        let power = 0;
        byForce.forEach(group => {
          const appliedRewards = group.filter(r => r.applied);
          if (!appliedRewards.length) return;
          const highest = appliedRewards.reduce((a, b) => a.value > b.value ? a : b);
          const stat = getStatName(highest.description);
          const normalized = STAT_MAP[stat] ?? stat.replace(/^(PVE |PVP )/, "").trim();
          power += highest.value * (POWER_TABLE[normalized] ?? 0);
        });
        return colAcc + power;
      }, 0);
    }, 0);
  }, [data]);

  // Total power if all collections were 100%
  const totalCollectionPower = useMemo(() => {
    if (!data) return 0;
    return data.reduce((catAcc, cat) => {
      return catAcc + cat.collections.reduce((colAcc, c) => {
        const byForce = new Map();
        c.rewards.forEach(r => {
          if (!byForce.has(r.force)) byForce.set(r.force, []);
          byForce.get(r.force).push(r);
        });
        let power = 0;
        byForce.forEach(group => {
          const top = group[group.length - 1]?.value ?? 0;
          const stat = getStatName(group[0].description);
          const normalized = STAT_MAP[stat] ?? stat.replace(/^(PVE |PVP )/, "").trim();
          power += top * (POWER_TABLE[normalized] ?? 0);
        });
        return colAcc + power;
      }, 0);
    }, 0);
  }, [data]);

  // Parse values array into offensive/defensive with earned overlay info
  const parsedValues = useMemo(() => {
    if (!data) return { offensive: [], defensive: [] };

    const totalMap = new Map();
    const earnedMap = new Map();

    data.forEach(cat => {
      cat.collections.forEach(c => {
        const byForce = new Map();
        c.rewards.forEach(r => {
          if (!byForce.has(r.force)) byForce.set(r.force, []);
          byForce.get(r.force).push(r);
        });
        byForce.forEach(group => {
          const stat = getStatName(group[0].description);

          // Total: last reward value (100% milestone) — cumulative
          const top = group[group.length - 1].value;
          totalMap.set(stat, (totalMap.get(stat) ?? 0) + top);

          // Earned: highest applied reward value — cumulative
          const appliedRewards = group.filter(r => r.applied);
          if (appliedRewards.length) {
            const highest = appliedRewards.reduce((a, b) => a.value > b.value ? a : b);
            earnedMap.set(stat, (earnedMap.get(stat) ?? 0) + highest.value);
          }
        });
      });
    });

    const offensive = [];
    const defensive = [];
    for (const [stat, total] of totalMap.entries()) {
      const earned = earnedMap.get(stat) ?? 0;
      const earnedPct = total > 0 ? Math.min((earned / total) * 100, 100) : 0;
      const entry = { stat, value: total, earned, earnedPct };
      if (DEFENSIVE_STATS.has(stat)) defensive.push(entry);
      else offensive.push(entry);
    }

    // Sort by value descending
    offensive.sort((a, b) => b.value - a.value);
    defensive.sort((a, b) => b.value - a.value);

    return { offensive, defensive };
  }, [data]);

  const categories = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data
      .filter(cat => !catFilter || String(cat.tId) === catFilter)
      .map(cat => ({
        ...cat,
        collections: cat.collections
          .filter(c => {
            if (c.progress >= 100) return false;
            if (typeFilter && getCollectionType(c) !== typeFilter) return false;
            if (!q) return true;
            return (
              c.name.toLowerCase().includes(q) ||
              c.missions.some(m =>
                m.data.some(i => !i.done && i.name.toLowerCase().includes(q))
              )
            );
          })
          .sort((a, b) => {
            if (sortBy === "name") return a.name.localeCompare(b.name);
            if (sortBy === "rewards") return b.rewards.filter(r => !r.applied).length - a.rewards.filter(r => !r.applied).length;
            if (sortBy === "power") return getRemainingPower(b) - getRemainingPower(a);
            return a.progress - b.progress;
          }),
      }))
      .filter(cat => cat.collections.length > 0);
  }, [data, search, catFilter, sortBy, typeFilter]);

  const totalIncomplete = useMemo(
    () => data?.reduce((acc, cat) => acc + cat.collections.filter(c => c.progress < 100).length, 0) ?? 0,
    [data]
  );
  const totalAll = useMemo(
    () => data?.reduce((acc, cat) => acc + cat.collections.length, 0) ?? 0,
    [data]
  );

  const summaryRewards = useMemo(() => {
    const map = new Map();
    categories.forEach(cat => {
      cat.collections.forEach(c => {
        const pct = Math.round(c.progress);
        const byForce = new Map();
        c.rewards.forEach(r => {
          if (!byForce.has(r.force)) byForce.set(r.force, []);
          byForce.get(r.force).push(r);
        });
        byForce.forEach(group => {
          const inc = calcIncremental(group);
          group.forEach((r, idx) => {
            if (pct >= MILESTONE_PCT[idx]) return;
            const stat = getStatName(r.description);
            map.set(stat, (map.get(stat) ?? 0) + inc[idx]);
          });
        });
      });
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [categories]);

  const totalPendingPower = useMemo(() => {
    return totalCollectionPower - earnedCollectionPower;
  }, [totalCollectionPower, earnedCollectionPower]);

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex gap-2 self-center">
        <input
          value={inputName}
          onChange={e => setInputName(e.target.value)}
          placeholder="Nome do personagem…"
          className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white flex-1 max-w-[220px] outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          suppressHydrationWarning
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Carregar
        </button>
      </form>

      {character && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 text-sm">
          <span className="font-bold text-zinc-900 dark:text-white text-base">{character.name}</span>
          <span className="text-zinc-500">Guild: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{character.guild || "—"}</span></span>
          <span className="text-zinc-500">Myth: <span className="font-semibold text-violet-600 dark:text-violet-400">{character.mythGradeName}</span></span>
          <span className="text-zinc-500">PVE: <span className="font-semibold text-red-400">{(character.atackPowerPVE + character.defensePowerPVE).toLocaleString('pt-BR')}</span></span>
          <span className="text-zinc-500">PVP: <span className="font-semibold text-red-400">{(character.atackPowerPVP + character.defensePowerPVP).toLocaleString('pt-BR')}</span></span>
          <span className="text-zinc-500 text-xs ml-auto">
            <span className="font-bold text-blue-600">{totalIncomplete}</span> de{" "}
            <span className="font-bold text-zinc-700 dark:text-zinc-300">{totalAll}</span> incompletas
          </span>
        </div>
      )}

      {data && (
        <div className="flex flex-wrap gap-3 items-center">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar palavra-chave…"
            className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white w-44 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
          >
            <option value="">⚔️🛡️ Todos os Tipos</option>
            <option value="offensive">⚔️ Ofensivo</option>
            <option value="defensive">🛡️ Defensivo</option>
          </select>
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
          >
            <option value="">Todas as Categorias</option>
            {data.map(cat => (
              <option key={cat.tId} value={String(cat.tId)}>{cat.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
          >
            <option value="progress">Ordenar: Progresso ↑</option>
            <option value="name">Ordenar: Nome A–Z</option>
            <option value="power">Ordenar: Maior Poder Pend.</option>
            {/* <option value="rewards">Ordenar: Mais Recompensas</option> */}
          </select>
          <span className="ml-auto text-xs text-zinc-400 text-right">
            Poder pendente: <span className="font-bold text-red-600">{totalPendingPower.toLocaleString()} 💥</span>
            <br />
            Exibindo <span className="font-bold text-blue-600">{categories.reduce((acc, cat) => acc + cat.collections.length, 0)}</span> coleções
          </span>
          <button
            onClick={() => setShowSummary(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            📊 Resumo de Recompensas
          </button>
          {values?.length > 0 && (
            <button
              onClick={() => setShowTotalPower(true)}
              className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              🏆 Progresso da Coleção
            </button>
          )}
        </div>
      )}

      {/* Resumo de Recompensas modal */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowSummary(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h2 className="font-bold text-zinc-900 dark:text-white text-base">📊 Resumo de Recompensas</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Total ainda a ganhar das coleções visíveis</p>
              </div>
              <button onClick={() => setShowSummary(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl font-bold leading-none">×</button>
            </div>
            <div className="overflow-y-auto px-6 py-4 flex flex-col gap-3">
              {summaryRewards.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">Nenhuma recompensa pendente.</p>
              ) : (
                summaryRewards.map(([stat, total]) => (
                  <div key={stat} className="flex items-center gap-4">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 w-48 shrink-0">{stat}</span>
                    <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                        style={{ width: `${Math.min((total / summaryRewards[0][1]) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 w-16 text-right">+{total.toLocaleString('pt-BR')}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Poder Total da Coleção modal */}
      {showTotalPower && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowTotalPower(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h2 className="font-bold text-zinc-900 dark:text-white text-base">📊 Progresso das Recompensas de Coleção</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Recompensas aplicadas vs total disponível nas coleções</p>
              </div>
              <button onClick={() => setShowTotalPower(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl font-bold leading-none">×</button>
            </div>

            {/* Power summary header */}
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-violet-50 dark:bg-violet-950/20 flex gap-6">
              <div className="flex-1">
                <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Poder Total da Coleção</p>
                <p className="text-2xl font-black text-violet-600 dark:text-violet-400">{totalCollectionPower.toLocaleString('pt-BR')} 💥</p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Poder Já Conquistado</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {earnedCollectionPower.toLocaleString('pt-BR')} 💥
                </p>
              </div>
            </div>

            <div className="overflow-y-auto px-6 py-4 flex flex-col gap-6">
              {parsedValues.offensive.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">⚔️ Ofensivo</p>
                  <div className="flex flex-col gap-2">
                    {parsedValues.offensive.map(({ stat, value, earned, earnedPct }) => (
                      <div key={stat} className="flex items-center gap-4">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300 w-48 shrink-0">{stat}</span>
                        <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden relative">
                          <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-red-400 to-orange-500 rounded-full" />
                          <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: `${earnedPct}%` }} />
                        </div>
                        <span className="text-sm w-16 text-right font-bold text-emerald-500">
                          {Math.round(earnedPct)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {parsedValues.defensive.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">🛡️ Defensivo</p>
                  <div className="flex flex-col gap-2">
                    {parsedValues.defensive.map(({ stat, value, earned, earnedPct }) => (
                      <div key={stat} className="flex items-center gap-4">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300 w-48 shrink-0">{stat}</span>
                        <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden relative">
                          <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-blue-400 to-violet-500 rounded-full" />
                          <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: `${earnedPct}%` }} />
                        </div>
                        <span className="text-sm w-16 text-right font-bold text-emerald-500">
                          {Math.round(earnedPct)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!data && !loading && !error && (
        <p className="text-sm text-zinc-500 text-center py-12">Digite o nome do personagem e clique em Carregar.</p>
      )}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-3 text-zinc-500">
          <div className="w-5 h-5 border-2 border-zinc-300 border-t-blue-500 rounded-full animate-spin" />
          Carregando coleção…
        </div>
      )}
      {error && (
        <p className="text-red-500 text-sm text-center py-8">⚠️ {error}</p>
      )}
      {!error && !loading && categories.length === 0 && data && (
        <p className="text-center text-zinc-500 py-12">🎉 Nenhuma coleção incompleta encontrada!</p>
      )}

      {!error && !loading && categories.map(cat => (
        <div key={cat.tId}>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{cat.name}</h2>
            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">{cat.collections.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cat.collections.map(c => (
              <CollectionCard key={c.cId} collection={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}