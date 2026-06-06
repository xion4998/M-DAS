import { useState, useMemo, useRef } from "react";

const ZONES = ["상부", "하부", "B", "C", "D", "P", "T", "W", "Z"];
const ZONE_COLORS = {
  "상부": "#8b5cf6", "하부": "#3b82f6", "B": "#f97316", "C": "#06b6d4",
  "D": "#ef4444", "P": "#10b981", "T": "#ec4899", "W": "#84cc16", "Z": "#f59e0b",
};

function CircleProgress({ percent, color, size = 90 }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.5s ease" }} />
    </svg>
  );
}

export default function App() {
  const [totalBatches, setTotalBatches] = useState(47);
  const [tempTotal, setTempTotal] = useState("47");
  const [data, setData] = useState(() => {
    const d = {};
    ZONES.forEach(z => { d[z] = { done: "" }; });
    return d;
  });
  const [activeZone, setActiveZone] = useState(ZONES[0]);
  const [activeBatch, setActiveBatch] = useState(1);
  const doneInputRef = useRef(null);
  const inputPanelRef = useRef(null);

  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const selectBatch = (b) => {
    setActiveBatch(b);
    setData(prev => ({ ...prev, [activeZone]: { done: b } }));
    setTimeout(() => {
      inputPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const applyTotalBatches = () => {
    const n = parseInt(tempTotal);
    if (!isNaN(n) && n > 0) { setTotalBatches(n); setActiveBatch(1); }
  };

  const handleDoneChange = (zone, val) => {
    const num = val === "" ? "" : Math.min(totalBatches, Math.max(0, parseInt(val) || 0));
    setData(prev => ({ ...prev, [zone]: { done: num } }));
  };

  const parseKakaoChat = () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    setParseResult(null);

    setTimeout(() => {
    try {
      const lines = pasteText.split("\n").map(l => l.trim()).filter(Boolean);
      const result = { "상부": null, "하부": null, "B": null, "C": null, "D": null, "P": null, "T": null, "W": null, "Z": null };

      const zoneKeywords = {
        "상부": ["상부", "메자닌상부", "m-das상부", "mdas상부"],
        "하부": ["하부", "메자닌하부", "m-das하부", "mdas하부", "메자닌하부m-das", "메자닌하부mdas"],
        "B": ["b존", "b zone"],
        "C": ["c존", "c zone"],
        "D": ["d존", "d zone"],
        "P": ["p존", "p zone"],
        "T": ["t존", "t zone"],
        "W": ["w존", "w zone"],
        "Z": ["z존", "z zone"],
      };

      let contextZones = [];

      for (const line of lines) {
        const lower = line.toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ");
        const detectedZones = [];

        const multiMatch = lower.match(/([a-z])\s*[.,·]\s*([a-z])(?:존)?/g);
        if (multiMatch) {
          for (const m of multiMatch) {
            const chars = m.match(/[a-z]/g);
            chars?.forEach(c => {
              const z = c.toUpperCase();
              if (result.hasOwnProperty(z)) detectedZones.push(z);
            });
          }
        }

        for (const [zone, keywords] of Object.entries(zoneKeywords)) {
          if (keywords.some(k => lower.includes(k))) {
            if (!detectedZones.includes(zone)) detectedZones.push(zone);
          }
        }

        if (detectedZones.length > 0) contextZones = detectedZones;

        let batchNum = null;

        const dasPattern = lower.match(/\d+\.\d+\/\d+차[-–]\s*(\d+)배치/);
        if (dasPattern) batchNum = parseInt(dasPattern[1]);

        if (batchNum === null) {
          const batchMatch = lower.match(/(\d+)배치\s*(진행|불출|대기|완료|피킹)/);
          if (batchMatch) batchNum = parseInt(batchMatch[1]);
        }

        if (batchNum === null) {
          const waveMatch = lower.match(/\d+-(\d+)\s*배치\s*중\s*(\d+)배치/);
          if (waveMatch) batchNum = parseInt(waveMatch[2]);
        }

        if (batchNum !== null && contextZones.length > 0) {
          contextZones.forEach(z => { result[z] = batchNum; });
        }
      }

      setParseResult(result);
    } catch (e) {
      setParseResult({ error: "파싱 실패: " + e.message });
    }
    setParsing(false);
    }, 50);
  };

  const applyParseResult = () => {
    if (!parseResult || parseResult.error) return;
    setData(prev => {
      const next = { ...prev };
      ZONES.forEach(z => {
        if (parseResult[z] !== null && parseResult[z] !== undefined) {
          next[z] = { done: Math.min(totalBatches, Number(parseResult[z])) };
        }
      });
      return next;
    });
    setShowPaste(false);
    setPasteText("");
    setParseResult(null);
  };

  const zoneTotals = useMemo(() => {
    const out = {};
    ZONES.forEach(z => {
      const done = data[z].done === "" ? 0 : Number(data[z].done);
      const pct = totalBatches > 0 ? Math.round((done / totalBatches) * 100) : 0;
      out[z] = { done, pct };
    });
    return out;
  }, [data, totalBatches]);

  const grand = useMemo(() => {
    const doneAll = ZONES.reduce((s, z) => s + zoneTotals[z].done, 0);
    const pct = totalBatches > 0 ? Math.round((doneAll / (totalBatches * ZONES.length)) * 100) : 0;
    return { done: doneAll, total: totalBatches, pct };
  }, [zoneTotals, totalBatches]);

  const currentDone = data[activeZone].done;
  const currentPct = currentDone !== "" && totalBatches > 0
    ? Math.round((Number(currentDone) / totalBatches) * 100) : null;

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1e", color: "#e2e8f0",
      fontFamily: "'Noto Sans KR', 'Segoe UI', sans-serif", padding: "20px 16px",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h1 style={{
          fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: "0.12em",
          background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
        }}>M-DAS</h1>
        <div style={{ fontSize: 11, letterSpacing: "0.25em", color: "#64748b", textTransform: "uppercase", marginTop: 4 }}>
          피킹 진행 현황
        </div>
      </div>

      {/* 오늘 총 배치 수 + 카톡 버튼 */}
      <div style={{
        background: "#111827", border: "1px solid #334155",
        borderRadius: 14, padding: "14px 16px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 12
      }}>
        <div style={{ fontSize: 13, color: "#94a3b8", whiteSpace: "nowrap" }}>오늘 전체 배치</div>
        <input
          type="number" min={1}
          value={tempTotal}
          onChange={e => setTempTotal(e.target.value)}
          onBlur={applyTotalBatches}
          onKeyDown={e => e.key === "Enter" && applyTotalBatches()}
          style={{
            width: 80, background: "#1e293b", border: "1px solid #475569",
            borderRadius: 8, padding: "7px 10px", color: "#f1f5f9",
            fontSize: 18, fontWeight: 900, outline: "none", textAlign: "center"
          }}
        />
        <div style={{ fontSize: 13, color: "#64748b" }}>배치</div>
        <div style={{
          marginLeft: "auto", fontSize: 12,
          background: "#1e3a5f", color: "#60a5fa",
          borderRadius: 8, padding: "4px 12px", fontWeight: 700
        }}>총 {totalBatches}배치</div>
        <button onClick={() => { setShowPaste(!showPaste); setParseResult(null); }} style={{
          background: showPaste ? "#7c3aed" : "#1e293b",
          border: "1px solid #7c3aed", borderRadius: 8, padding: "6px 12px",
          cursor: "pointer", color: showPaste ? "#fff" : "#a78bfa",
          fontSize: 12, fontWeight: 700, whiteSpace: "nowrap"
        }}>💬 카톡</button>
      </div>

      {/* 카톡 붙여넣기 패널 */}
      {showPaste && (
        <div style={{
          background: "#111827", border: "1px solid #7c3aed55",
          borderRadius: 14, padding: 16, marginBottom: 16
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 10 }}>
            💬 카톡 대화 붙여넣기
          </div>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={"카카오톡 채팅 내용 복사해서 붙여넣기\n예) W존 8차 6배치 불출대기\n    메자닌하부M-DAS* 6.5/8차-3배치 대기중"}
            style={{
              width: "100%", minHeight: 120, background: "#0f172a",
              border: "1px solid #334155", borderRadius: 10,
              padding: "10px 12px", color: "#e2e8f0", fontSize: 12,
              lineHeight: 1.6, outline: "none", resize: "vertical",
              boxSizing: "border-box", fontFamily: "inherit"
            }}
          />
          <button onClick={parseKakaoChat} disabled={parsing || !pasteText.trim()} style={{
            marginTop: 10, width: "100%",
            background: parsing ? "#1e293b" : "linear-gradient(90deg, #7c3aed, #4f46e5)",
            border: "none", borderRadius: 10, padding: "12px 0",
            color: parsing ? "#64748b" : "#fff",
            fontSize: 14, fontWeight: 800, cursor: parsing ? "not-allowed" : "pointer"
          }}>
          {parsing ? "⏳ 분석중..." : "🔍 파싱"}
          </button>

          {parseResult && !parseResult.error && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>파싱 결과 — 확인 후 적용하세요</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
                {ZONES.map(z => {
                  const val = parseResult[z];
                  return (
                    <div key={z} style={{
                      background: val !== null ? ZONE_COLORS[z] + "22" : "#1e293b",
                      border: `1px solid ${val !== null ? ZONE_COLORS[z] + "55" : "#334155"}`,
                      borderRadius: 8, padding: "8px", textAlign: "center"
                    }}>
                      <div style={{ fontSize: 11, color: ZONE_COLORS[z], fontWeight: 700 }}>{z}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: val !== null ? "#f1f5f9" : "#475569" }}>
                        {val !== null ? val : "–"}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={applyParseResult} style={{
                width: "100%", background: "linear-gradient(90deg, #10b981, #059669)",
                border: "none", borderRadius: 10, padding: "12px 0",
                color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer"
              }}>✅ 반영하기</button>
            </div>
          )}
          {parseResult?.error && (
            <div style={{ marginTop: 10, color: "#ef4444", fontSize: 12, textAlign: "center" }}>
              {parseResult.error}
            </div>
          )}
        </div>
      )}

      {/* Grand Total */}
      <div style={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #1e1b4b 100%)",
        border: "1px solid #334155", borderRadius: 16, padding: "20px 24px",
        marginBottom: 20, display: "flex", alignItems: "center", gap: 20,
      }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <CircleProgress percent={grand.pct} color="#60a5fa" size={90} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#60a5fa" }}>{grand.pct}%</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>전체 토탈 피킹작업률</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9" }}>
            {grand.pct}%
            <span style={{ fontSize: 13, color: "#64748b" }}> / {totalBatches}배치</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {ZONES.map(z => (
              <span key={z} style={{
                fontSize: 10, padding: "2px 7px", borderRadius: 20,
                background: ZONE_COLORS[z] + "22", color: ZONE_COLORS[z],
                border: `1px solid ${ZONE_COLORS[z]}44`
              }}>{z} {zoneTotals[z].pct}%</span>
            ))}
          </div>
        </div>
      </div>

      {/* Zone Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {ZONES.map(z => {
          const { done, pct } = zoneTotals[z];
          const isActive = z === activeZone;
          return (
            <button key={z} onClick={() => setActiveZone(z)} style={{
              background: isActive ? `linear-gradient(135deg, ${ZONE_COLORS[z]}33, ${ZONE_COLORS[z]}11)` : "#111827",
              border: `1.5px solid ${isActive ? ZONE_COLORS[z] : "#1e293b"}`,
              borderRadius: 12, padding: "12px 8px", cursor: "pointer",
              color: "#e2e8f0", textAlign: "center", transition: "all 0.2s",
            }}>
              <div style={{ fontSize: 12, color: ZONE_COLORS[z], fontWeight: 700, marginBottom: 4 }}>{z} 존</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{pct}%</div>
              <div style={{ height: 4, background: "#1e293b", borderRadius: 2, margin: "6px 0 4px" }}>
                <div style={{ height: 4, borderRadius: 2, background: ZONE_COLORS[z], width: `${pct}%`, transition: "width 0.4s ease" }} />
              </div>
              <div style={{ fontSize: 10, color: "#64748b" }}>{done} / {totalBatches}</div>
            </button>
          );
        })}
      </div>

      {/* 입력 패널 */}
      <div ref={inputPanelRef} style={{
        background: "#111827", border: `1.5px solid ${ZONE_COLORS[activeZone]}55`,
        borderRadius: 16, padding: 16, marginBottom: 20
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            <span style={{ color: ZONE_COLORS[activeZone] }}>{activeZone} 존</span>
            <span style={{ color: "#64748b", marginLeft: 6 }}>완료 배치 입력</span>
          </div>
          <div style={{
            fontSize: 12, fontWeight: 800,
            background: currentDone !== "" ? ZONE_COLORS[activeZone] + "22" : "#1e293b",
            color: currentDone !== "" ? ZONE_COLORS[activeZone] : "#475569",
            border: `1px solid ${currentDone !== "" ? ZONE_COLORS[activeZone] + "55" : "#334155"}`,
            borderRadius: 20, padding: "4px 12px", transition: "all 0.2s"
          }}>
            {currentDone !== "" ? `${totalBatches}배치 중 ${currentDone}배치 완료` : "미입력"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4, marginBottom: 16 }}>
          {Array.from({ length: totalBatches }, (_, i) => i + 1).map(b => {
            const done = data[activeZone].done;
            const completed = done !== "" && b <= Number(done);
            const isActive = activeBatch === b;
            return (
              <button key={b} onClick={() => selectBatch(b)} style={{
                background: isActive ? ZONE_COLORS[activeZone] : completed ? ZONE_COLORS[activeZone] + "33" : "#1e293b",
                border: `1px solid ${isActive ? ZONE_COLORS[activeZone] : completed ? ZONE_COLORS[activeZone] + "66" : "#374151"}`,
                borderRadius: 6, padding: "6px 2px", cursor: "pointer",
                color: isActive ? "#fff" : completed ? ZONE_COLORS[activeZone] : "#4b5563",
                fontSize: 11, fontWeight: 700,
                transform: isActive ? "scale(1.1)" : "scale(1)",
                transition: "all 0.15s",
              }}>
                {b}
              </button>
            );
          })}
        </div>

        <div style={{
          background: "#0f172a", borderRadius: 12, padding: "16px 20px",
          border: `1px solid ${ZONE_COLORS[activeZone]}44`,
          display: "flex", alignItems: "center", gap: 16
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>완료 배치 수</div>
            <input
              ref={doneInputRef}
              type="number" min={0} max={totalBatches}
              value={currentDone}
              onChange={e => handleDoneChange(activeZone, e.target.value)}
              placeholder="0"
              style={{
                width: "100%", background: "#1e293b",
                border: `1.5px solid ${ZONE_COLORS[activeZone]}77`,
                borderRadius: 10, padding: "10px 14px", color: "#f1f5f9",
                fontSize: 22, fontWeight: 900, outline: "none", boxSizing: "border-box",
                textAlign: "center"
              }}
            />
          </div>
          <div style={{ textAlign: "center", paddingTop: 20 }}>
            <div style={{ color: "#475569", fontSize: 20, marginBottom: 2 }}>/</div>
            <div style={{ fontSize: 10, color: "#475569" }}>중</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>전체 배치</div>
            <div style={{
              background: "#1e293b", borderRadius: 10, padding: "10px 14px",
              fontSize: 22, fontWeight: 900, color: "#64748b",
              border: "1.5px solid #334155"
            }}>{totalBatches}</div>
          </div>
          <div style={{
            minWidth: 58, textAlign: "center", paddingTop: 20,
            fontSize: 24, fontWeight: 900,
            color: currentPct !== null ? ZONE_COLORS[activeZone] : "#334155",
            transition: "color 0.2s"
          }}>
            {currentPct !== null ? `${currentPct}%` : "–"}
          </div>
        </div>

        {currentDone !== "" && (
          <div style={{
            marginTop: 10, textAlign: "center", fontSize: 13, fontWeight: 700,
            color: ZONE_COLORS[activeZone]
          }}>
            총 {totalBatches}배치 중 {currentDone}배치 완료 ({currentPct}%)
          </div>
        )}
      </div>

      {/* 존별 요약 */}
      <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>존별 요약</div>
        </div>

        {/* 텍스트 미리보기 */}
        {(() => {
          const now = new Date();
          const month = now.getMonth() + 1;
          const day = now.getDate();
          const timeStr = `${now.getHours()}시${now.getMinutes().toString().padStart(2,"0")}분`;
          const completed = ZONES.filter(z => zoneTotals[z].pct === 100);
          const inProgress = ZONES.filter(z => zoneTotals[z].pct < 100 && zoneTotals[z].done > 0);
          const notStarted = ZONES.filter(z => zoneTotals[z].done === 0);

          const lines = [
            `M-DAS (${timeStr})`,
            `${month}월${day}일자 ${totalBatches}배치`,
            `──────────────`,
          ];

          if (completed.length > 0) {
            lines.push(`✅ ${completed.map(z => z.length <= 1 ? z+"존" : z).join(", ")} 불출완료`);
          }

          inProgress.forEach(z => {
            const { done } = zoneTotals[z];
            lines.push(`🔄 ${z.length <= 1 ? z+"존" : z} ${done}배치 불출중`);
          });

          if (notStarted.length > 0) {
            lines.push(`⏳ 미시작  ${notStarted.map(z => z.length <= 1 ? z+"존" : z).join(", ")}`);
          }

          lines.push(`──────────────`);
          lines.push(`토탈 ${grand.pct}%`);
          const text = lines.join("\n");

          return (
            <>
              <div style={{
                background: "#0f172a", borderRadius: 10, padding: "12px 14px",
                marginBottom: 12, fontSize: 12, lineHeight: 1.8,
                color: "#94a3b8", fontFamily: "monospace", whiteSpace: "pre-wrap"
              }}>{text}</div>
              <button onClick={() => {
                navigator.clipboard.writeText(text).then(() => setCopied(true));
                setTimeout(() => setCopied(false), 2000);
              }} style={{
                width: "100%",
                background: copied ? "#10b981" : "#1e293b",
                border: `1px solid ${copied ? "#10b981" : "#334155"}`,
                borderRadius: 8, padding: "10px 0", cursor: "pointer",
                color: copied ? "#fff" : "#94a3b8",
                fontSize: 13, fontWeight: 700, transition: "all 0.2s", marginBottom: 12
              }}>
                {copied ? "✓ 복사됨!" : "📋 카톡에 붙여넣기용 복사"}
              </button>
            </>
          );
        })()}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* 완료 존 묶음 */}
          {(() => {
            const completed = ZONES.filter(z => zoneTotals[z].pct === 100);
            if (completed.length === 0) return null;
            return (
              <div style={{
                background: "#14532d22", border: "1px solid #4ade8055",
                borderRadius: 10, padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10
              }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <div>
                  <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, marginBottom: 2 }}>피킹 완료</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#f1f5f9" }}>
                    {completed.map((z, i) => (
                      <span key={z}>
                        <span style={{ color: ZONE_COLORS[z] }}>{z.length <= 1 ? z+"존" : z}</span>
                        {i < completed.length - 1 && <span style={{ color: "#475569" }}> · </span>}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 13, color: "#4ade80", fontWeight: 800 }}>
                  {completed.length}개 존
                </div>
              </div>
            );
          })()}

          {/* 미완료 존 */}
          {ZONES.filter(z => zoneTotals[z].pct < 100).map(z => {
            const { done, pct } = zoneTotals[z];
            return (
              <div key={z} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ZONE_COLORS[z], minWidth: 32, textAlign: "center" }}>{z}</div>
                <div style={{ flex: 1, height: 8, background: "#1e293b", borderRadius: 4 }}>
                  <div style={{
                    height: 8, borderRadius: 4,
                    background: `linear-gradient(90deg, ${ZONE_COLORS[z]}, ${ZONE_COLORS[z]}88)`,
                    width: `${pct}%`, transition: "width 0.4s ease"
                  }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, minWidth: 40, textAlign: "right", color: "#f1f5f9" }}>
                  {pct}%
                </div>
                <div style={{ fontSize: 11, color: "#64748b", minWidth: 80, textAlign: "right" }}>
                  {done} / {totalBatches}배치
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
