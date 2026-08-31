/* eslint-disable */
import { useState, useMemo, useRef, useEffect } from "react";

const EDIT_PASSWORD = "005"; // 수정 비밀번호
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBr-Vq8kDPrxNv8RojdrPa_GUgXth2tHmg",
  authDomain: "teamnight-d909b.firebaseapp.com",
  databaseURL: "https://teamnight-d909b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "teamnight-d909b",
  storageBucket: "teamnight-d909b.firebasestorage.app",
  messagingSenderId: "440378727824",
  appId: "1:440378727824:web:2c4bf51c6c57f8f7d96715"
};

let fdb = null;
try { fdb = getDatabase(initializeApp(firebaseConfig)); } catch (e) {}
const FB_PATH = "mdas";
const dbSet = (path, val) => { try { if (fdb) set(ref(fdb, path), val); } catch (e) {} };

try {
  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css";
  document.head.appendChild(fontLink);
} catch (e) {}

const ZONES = ["상부", "하부", "B", "C", "D", "P/Z", "T", "W", "V"];
const ZONE_COLORS = {
  "상부": "#7c3aed", "하부": "#2563eb", "B": "#ea580c", "C": "#0891b2",
  "D": "#dc2626", "P/Z": "#059669", "T": "#db2777", "W": "#65a30d", "V": "#6366f1",
};

const initData = () => {
  try {
    const saved = localStorage.getItem("mdas_data");
    if (saved) {
      const d = JSON.parse(saved);
      if (d["P"] !== undefined && d["P/Z"] === undefined) { d["P/Z"] = d["P"]; delete d["P"]; }
      if (d["Z"] !== undefined && d["V"] === undefined) { d["V"] = d["Z"]; delete d["Z"]; }
      if (d["V"] === undefined) d["V"] = { done: "", picking: false };
      return d;
    }
  } catch (e) {}
  const d = {};
  ZONES.forEach(z => { d[z] = { done: "", picking: false }; });
  return d;
};

const initTotal = () => {
  try { return parseInt(localStorage.getItem("mdas_totalBatches")) || 47; } catch (e) { return 47; }
};

function CircleProgress({ percent, color, size = 90 }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  if (loading) {
    return (
      <div style={{ minHeight:"100vh", background:"#f0f4f8", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
        <div style={{ fontSize:28, fontWeight:900, background:"linear-gradient(135deg,#1e40af,#7c3aed)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:16 }}>M-DAS</div>
        <div style={{ width:40, height:40, border:"4px solid #e2e8f0", borderTop:"4px solid #1e40af", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ marginTop:16, fontSize:13, color:"#64748b" }}>데이터 불러오는 중...</div>
      </div>
    );
  }

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.5s ease" }} />
    </svg>
  );
}

export default function App() {
  const [totalBatches, setTotalBatches] = useState(initTotal);
  const [tempTotal, setTempTotal] = useState(() => String(initTotal()));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(initData);
  const [activeZone, setActiveZone] = useState(ZONES[0]);
  const [activeBatch, setActiveBatch] = useState(1);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editable, setEditable] = useState(() => {
    try { return localStorage.getItem("mdas_editable") === "true"; } catch (e) { return false; }
  });
  const [showPwInput, setShowPwInput] = useState(false);
  const [pwValue, setPwValue] = useState("");

  const tryUnlock = () => {
    if (pwValue === EDIT_PASSWORD) {
      setEditable(true);
      try { localStorage.setItem("mdas_editable", "true"); } catch (e) {}
      setShowPwInput(false); setPwValue("");
    } else {
      setPwValue("");
    }
  };

  const lockEdit = () => {
    setEditable(false);
    try { localStorage.setItem("mdas_editable", "false"); } catch (e) {}
  };

  const doneInputRef = useRef(null);
  const inputPanelRef = useRef(null);

  const saveData = (newData) => { if (!editable) return;
    setData(newData);
    try { localStorage.setItem("mdas_data", JSON.stringify(newData)); } catch (e) {} dbSet("mdas/data", newData);
  };

  const saveTotalBatches = (n) => { if (!editable) return;
    setTotalBatches(n);
    setTempTotal(String(n));
    try { localStorage.setItem("mdas_totalBatches", String(n)); } catch (e) {} dbSet("mdas/total", n);
  };

  const selectBatch = (b) => {
    setActiveBatch(b);
    saveData({ ...data, [activeZone]: { ...data[activeZone], done: b } });
    setTimeout(() => inputPanelRef.current && inputPanelRef.current.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const applyTotalBatches = () => {
    const n = parseInt(tempTotal);
    if (!isNaN(n) && n > 0) { saveTotalBatches(n); setActiveBatch(1); }
  };

  const handleDoneChange = (zone, val) => {
    const num = val === "" ? "" : Math.min(totalBatches, Math.max(0, parseInt(val) || 0));
    saveData({ ...data, [zone]: { ...data[zone], done: num } });
  };

  const togglePicking = (zone) => {
    const isPicking = data[zone].picking;
    const newPicking = !isPicking;
    saveData({
      ...data,
      [zone]: {
        ...data[zone],
        picking: newPicking,
        // 피킹완료 시 전체 배치 자동 채움, 해제 시 그대로
        done: newPicking ? totalBatches : data[zone].done,
      }
    });
  };

  const resetAll = () => {
    if (!window.confirm("전체 초기화할까요?")) return;
    const d = {};
    ZONES.forEach(z => { d[z] = { done: "", picking: false }; });
    saveData(d);
  };

  const parseKakaoChat = () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    setParseResult(null);
    setTimeout(() => {
      try {
        const lines = pasteText.split("\n").map(l => l.trim()).filter(Boolean);
        const result = {};
        ZONES.forEach(z => { result[z] = null; });
        const zoneKeywords = {
          "상부": ["상부", "메자닌상부", "m-das상부"],
          "하부": ["하부", "메자닌하부", "m-das하부", "메자닌하부m-das"],
          "B": ["b존"], "C": ["c존"], "D": ["d존"],
          "P": ["p존"], "T": ["t존"], "W": ["w존"], "Z": ["z존"],
        };
        let contextZones = [];
        for (const line of lines) {
          const lower = line.toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ");
          const detected = [];
          const multi = lower.match(/([a-z])\s*[.,·]\s*([a-z])(?:존)?/g);
          if (multi) {
            for (const m of multi) {
              const chars = m.match(/[a-z]/g);
              chars && chars.forEach(c => {
                const z = c.toUpperCase();
                if (result.hasOwnProperty(z) && !detected.includes(z)) detected.push(z);
              });
            }
          }
          for (const [zone, kws] of Object.entries(zoneKeywords)) {
            if (kws.some(k => lower.includes(k)) && !detected.includes(zone)) detected.push(zone);
          }
          if (detected.length > 0) contextZones = detected;
          let num = null;
          const p1 = lower.match(/\d+\.\d+\/\d+차[-–]\s*(\d+)배치/);
          if (p1) num = parseInt(p1[1]);
          if (num === null) { const p2 = lower.match(/(\d+)배치\s*(진행|불출|대기|완료|피킹)/); if (p2) num = parseInt(p2[1]); }
          if (num === null) { const p3 = lower.match(/\d+-\d+\s*배치\s*중\s*(\d+)배치/); if (p3) num = parseInt(p3[1]); }
          if (num !== null && contextZones.length > 0) contextZones.forEach(z => { result[z] = num; });
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
    const next = { ...data };
    ZONES.forEach(z => {
      if (parseResult[z] !== null && parseResult[z] !== undefined) {
        next[z] = { ...next[z], done: Math.min(totalBatches, Number(parseResult[z])) };
      }
    });
    saveData(next);
    setShowPaste(false); setPasteText(""); setParseResult(null);
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


  // Firebase 실시간 구독
  useEffect(() => {
    if (!fdb) return;
    const subs = [];
    subs.push(onValue(ref(fdb, "mdas/data"), snap => {
      const v = snap.val();
      if (v) {
        setData(v);
        try { localStorage.setItem("mdas_data", JSON.stringify(v)); } catch (e) {}
      }
      setLoading(false);
    }));
    subs.push(onValue(ref(fdb, "mdas/total"), snap => {
      const v = snap.val();
      if (v) { setTotalBatches(v); setTempTotal(String(v)); }
    }));
    const timeout = setTimeout(() => setLoading(false), 3000);
    return () => { subs.forEach(u => u()); clearTimeout(timeout); };
  }, []);

  const grand = useMemo(() => {
    const doneAll = ZONES.reduce((s, z) => s + zoneTotals[z].done, 0);
    const pct = totalBatches > 0 ? Math.round((doneAll / (totalBatches * ZONES.length)) * 100) : 0;
    return { done: doneAll, total: totalBatches, pct };
  }, [zoneTotals, totalBatches]);

  // 대시보드용 요약 실시간 전송
  useEffect(() => {
    dbSet("summary/mdas", { pct: grand.pct, ts: Date.now() });
  }, [grand.pct, grand.flowPct, grand.shelfPct]);

  const currentDone = data[activeZone].done;
  const currentPct = currentDone !== "" && totalBatches > 0
    ? Math.round((Number(currentDone) / totalBatches) * 100) : null;

  const S = {
    bg: "#f0f4f8",
    card: "#ffffff",
    border: "#e2e8f0",
    text: "#0f172a",
    textSub: "#64748b",
    inputBg: "#f8fafc",
    shadow: "0 1px 8px rgba(0,0,0,0.08)",
    shadowMd: "0 2px 16px rgba(0,0,0,0.10)",
  };

  return (
    <div style={{ minHeight: "100vh", background: S.bg, color: S.text, fontFamily: "'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif", padding: "20px 16px" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: "0.08em", background: "linear-gradient(135deg,#1e40af,#7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>M-DAS</h1>
        <div style={{ fontSize: 11, letterSpacing: "0.3em", color: S.textSub, textTransform: "uppercase", marginTop: 4, fontWeight: 500 }}>피킹 진행 현황</div>
        {/* 잠금 상태 */}
        <div style={{ marginTop: 10 }}>
          {editable ? (
            <button onClick={lockEdit} style={{ fontSize: 11, fontWeight: 700, padding: "5px 16px", borderRadius: 20, cursor: "pointer", background: "#dcfce7", border: "1px solid #86efac", color: "#15803d", fontFamily: "inherit" }}>
              🔓 수정 가능 · 탭하여 잠금
            </button>
          ) : showPwInput ? (
            <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
              <input type="password" inputMode="numeric" value={pwValue} autoFocus
                onChange={e => setPwValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && tryUnlock()}
                placeholder="비밀번호"
                style={{ width: 100, background: "#fff", border: "1.5px solid #7c3aed", borderRadius: 10, padding: "6px 10px", fontSize: 14, fontWeight: 700, outline: "none", textAlign: "center", fontFamily: "inherit" }} />
              <button onClick={tryUnlock} style={{ fontSize: 12, fontWeight: 800, padding: "7px 14px", borderRadius: 10, cursor: "pointer", background: "#7c3aed", border: "none", color: "#fff", fontFamily: "inherit" }}>확인</button>
              <button onClick={() => { setShowPwInput(false); setPwValue(""); }} style={{ fontSize: 12, fontWeight: 700, padding: "7px 10px", borderRadius: 10, cursor: "pointer", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#94a3b8", fontFamily: "inherit" }}>취소</button>
            </div>
          ) : (
            <button onClick={() => setShowPwInput(true)} style={{ fontSize: 11, fontWeight: 700, padding: "5px 16px", borderRadius: 20, cursor: "pointer", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#94a3b8", fontFamily: "inherit" }}>
              🔒 보기 전용 · 탭하여 잠금해제
            </button>
          )}
        </div>
      </div>

      {/* 설정 바 */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, boxShadow: S.shadow }}>
        <div style={{ fontSize: 12, color: S.textSub, whiteSpace: "nowrap", fontWeight: 500 }}>오늘 배치</div>
        <input type="number" min={1} value={tempTotal}
          onChange={e => setTempTotal(e.target.value)}
          onBlur={applyTotalBatches}
          onKeyDown={e => e.key === "Enter" && applyTotalBatches()}
          style={{ width: 60, background: S.inputBg, border: `1px solid ${S.border}`, borderRadius: 8, padding: "6px 6px", color: S.text, fontSize: 17, fontWeight: 700, outline: "none", textAlign: "center", fontFamily: "inherit" }} />
        <button onClick={() => { setShowPaste(!showPaste); setParseResult(null); }} style={{ marginLeft: "auto", background: showPaste ? "#7c3aed" : S.inputBg, border: `1px solid ${showPaste ? "#7c3aed" : S.border}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: showPaste ? "#fff" : S.textSub, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "inherit" }}>💬 카톡</button>
      </div>

      {/* 카톡 패널 */}
      {showPaste && (
        <div style={{ background: S.card, border: "1px solid #e9d5ff", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: S.shadow }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", marginBottom: 10 }}>💬 카톡 대화 붙여넣기</div>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
            placeholder={"카카오톡 채팅 내용 복사해서 붙여넣기\n예) W존 8차 6배치 불출대기\n    메자닌하부M-DAS* 6.5/8차-3배치 대기중"}
            style={{ width: "100%", minHeight: 120, background: S.inputBg, border: `1px solid ${S.border}`, borderRadius: 10, padding: "10px 12px", color: S.text, fontSize: 12, lineHeight: 1.6, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
          <button onClick={parseKakaoChat} disabled={parsing || !pasteText.trim()} style={{ marginTop: 10, width: "100%", background: parsing ? S.inputBg : "linear-gradient(90deg,#7c3aed,#4f46e5)", border: "none", borderRadius: 10, padding: "12px 0", color: parsing ? S.textSub : "#fff", fontSize: 14, fontWeight: 800, cursor: parsing ? "not-allowed" : "pointer" }}>
            {parsing ? "⏳ 분석중..." : "🔍 파싱"}
          </button>
          {parseResult && !parseResult.error && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: S.textSub, marginBottom: 8 }}>파싱 결과 — 확인 후 적용하세요</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 12 }}>
                {ZONES.map(z => {
                  const val = parseResult[z];
                  return (
                    <div key={z} style={{ background: val !== null ? ZONE_COLORS[z]+"15" : S.inputBg, border: `1px solid ${val !== null ? ZONE_COLORS[z]+"44" : S.border}`, borderRadius: 8, padding: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: ZONE_COLORS[z], fontWeight: 700 }}>{z}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: val !== null ? S.text : S.textSub }}>{val !== null ? val : "–"}</div>
                    </div>
                  );
                })}
              </div>
              <button onClick={applyParseResult} style={{ width: "100%", background: "linear-gradient(90deg,#059669,#047857)", border: "none", borderRadius: 10, padding: "12px 0", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>✅ 반영하기</button>
            </div>
          )}
          {parseResult && parseResult.error && (
            <div style={{ marginTop: 10, color: "#dc2626", fontSize: 12, textAlign: "center" }}>{parseResult.error}</div>
          )}
        </div>
      )}

      {/* Grand Total */}
      <div style={{ background: "linear-gradient(135deg,#1e40af,#7c3aed)", borderRadius: 16, padding: "20px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 20, boxShadow: "0 4px 20px rgba(37,99,235,0.3)" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <CircleProgress percent={grand.pct} color="#ffffff" size={90} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{grand.pct}%</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>전체 토탈 피킹작업률</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>
            {grand.pct}% <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>/ {totalBatches}배치</span>
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
            {ZONES.map(z => (
              <span key={z} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>{z} {zoneTotals[z].pct}%</span>
            ))}
          </div>
        </div>
      </div>

      {/* Zone Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
        {ZONES.map(z => {
          const { done, pct } = zoneTotals[z];
          const isActive = z === activeZone;
          const isPicking = data[z].picking;
          const isBul = pct === 100 && !isPicking;
          const color = ZONE_COLORS[z];
          return (
            <div key={z} style={{ background: isActive ? color+"12" : S.card, border: `1.5px solid ${isActive ? color : S.border}`, borderRadius: 12, padding: "10px 8px", textAlign: "center", boxShadow: S.shadow, transition: "all 0.2s" }}>
              <button onClick={() => setActiveZone(z)} style={{ background: "none", border: "none", cursor: "pointer", width: "100%", padding: 0 }}>
                <div style={{ fontSize: 12, color, fontWeight: 700, marginBottom: 4 }}>{z} 존</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: S.text }}>{pct}%</div>
                <div style={{ height: 4, background: "#e2e8f0", borderRadius: 2, margin: "6px 0 4px" }}>
                  <div style={{ height: 4, borderRadius: 2, background: color, width: `${pct}%`, transition: "width 0.4s" }} />
                </div>
                <div style={{ fontSize: 10, color: S.textSub, marginBottom: 6 }}>{done} / {totalBatches}</div>
              </button>
              <button onClick={() => togglePicking(z)} style={{
                width: "100%", fontSize: 10, fontWeight: 800, padding: "5px 0", borderRadius: 7, cursor: "pointer", transition: "all 0.15s",
                background: isPicking ? "#dcfce7" : "#f8fafc",
                border: `1.5px solid ${isBul ? "#86efac" : isPicking ? "#fde047" : "#e2e8f0"}`,
                color: isBul ? "#15803d" : isPicking ? "#a16207" : "#94a3b8",
              }}>
                {isPicking ? "✓ 피킹완료" : "피킹완료"}
              </button>
            </div>
          );
        })}
      </div>

      {/* 입력 패널 */}
      <div ref={inputPanelRef} style={{ background: S.card, border: `1.5px solid ${ZONE_COLORS[activeZone]}`, borderRadius: 16, padding: 16, marginBottom: 20, boxShadow: S.shadowMd }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            <span style={{ color: ZONE_COLORS[activeZone] }}>{activeZone} 존</span>
            <span style={{ color: S.textSub, marginLeft: 6 }}>완료 배치 입력</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, background: currentDone !== "" ? ZONE_COLORS[activeZone]+"15" : S.inputBg, color: currentDone !== "" ? ZONE_COLORS[activeZone] : S.textSub, border: `1px solid ${currentDone !== "" ? ZONE_COLORS[activeZone]+"44" : S.border}`, borderRadius: 20, padding: "4px 12px" }}>
            {currentDone !== "" ? `${totalBatches}배치 중 ${currentDone}배치 완료` : "미입력"}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: 4, marginBottom: 16 }}>
          {Array.from({ length: totalBatches }, (_, i) => i + 1).map(b => {
            const done = data[activeZone].done;
            const completed = done !== "" && b <= Number(done);
            const isAct = activeBatch === b;
            return (
              <button key={b} onClick={() => selectBatch(b)} style={{
                background: isAct ? ZONE_COLORS[activeZone] : completed ? ZONE_COLORS[activeZone]+"20" : S.inputBg,
                border: `1px solid ${isAct ? ZONE_COLORS[activeZone] : completed ? ZONE_COLORS[activeZone]+"55" : S.border}`,
                borderRadius: 6, padding: "6px 2px", cursor: "pointer",
                color: isAct ? "#fff" : completed ? ZONE_COLORS[activeZone] : S.textSub,
                fontSize: 11, fontWeight: 700,
                transform: isAct ? "scale(1.1)" : "scale(1)", transition: "all 0.15s",
              }}>
                {b}
              </button>
            );
          })}
        </div>
        <div style={{ background: S.inputBg, borderRadius: 12, padding: "16px 20px", border: `1px solid ${S.border}`, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: S.textSub, marginBottom: 6 }}>완료 배치 수</div>
            <input ref={doneInputRef} type="number" min={0} max={totalBatches} value={currentDone}
              onChange={e => handleDoneChange(activeZone, e.target.value)} placeholder="0"
              style={{ width: "100%", background: S.card, border: `1.5px solid ${ZONE_COLORS[activeZone]}`, borderRadius: 10, padding: "10px 14px", color: S.text, fontSize: 22, fontWeight: 900, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
          </div>
          <div style={{ textAlign: "center", paddingTop: 20 }}>
            <div style={{ color: S.textSub, fontSize: 20 }}>/</div>
            <div style={{ fontSize: 10, color: S.textSub }}>중</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: S.textSub, marginBottom: 6 }}>전체 배치</div>
            <div style={{ background: S.card, borderRadius: 10, padding: "10px 14px", fontSize: 22, fontWeight: 900, color: S.textSub, border: `1px solid ${S.border}` }}>{totalBatches}</div>
          </div>
          <div style={{ minWidth: 58, textAlign: "center", paddingTop: 20, fontSize: 24, fontWeight: 900, color: currentPct !== null ? ZONE_COLORS[activeZone] : "#cbd5e1" }}>
            {currentPct !== null ? `${currentPct}%` : "–"}
          </div>
        </div>
        {currentDone !== "" && (
          <div style={{ marginTop: 10, textAlign: "center", fontSize: 13, fontWeight: 700, color: ZONE_COLORS[activeZone] }}>
            총 {totalBatches}배치 중 {currentDone}배치 완료 ({currentPct}%)
          </div>
        )}
      </div>

      {/* 존별 요약 */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, padding: 16, boxShadow: S.shadow }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: S.text, marginBottom: 12 }}>존별 요약</div>

        {/* 텍스트 미리보기 */}
        {(() => {
          const now = new Date();
          const timeStr = `${now.getHours()}시${now.getMinutes().toString().padStart(2,"0")}분`;
          const month = now.getMonth() + 1;
          const day = now.getDate();
          const bulDone = ZONES.filter(z => zoneTotals[z].pct === 100 && !data[z].picking);
          const pickDone = ZONES.filter(z => data[z].picking);
          const inProgress = ZONES.filter(z => !data[z].picking && zoneTotals[z].pct < 100 && zoneTotals[z].done > 0);
          const notStarted = ZONES.filter(z => !data[z].picking && zoneTotals[z].pct === 0);
          const lines = [
            `M-DAS (${timeStr})`,
            `${month}월${day}일자 ${totalBatches}배치`,
            `──────────────`,
          ];
          if (bulDone.length > 0) lines.push(`✅ ${bulDone.map(z => z.length<=1?z+"존":z).join(", ")} 불출완료`);
          if (pickDone.length > 0) lines.push(`🟡 ${pickDone.map(z => z.length<=1?z+"존":z).join(", ")} 피킹완료`);
          inProgress.forEach(z => lines.push(`🔄 ${z.length<=1?z+"존":z} ${zoneTotals[z].done}배치 불출중`));
          if (notStarted.length > 0) lines.push(`⏳ 미시작  ${notStarted.map(z => z.length<=1?z+"존":z).join(", ")}`);
          lines.push(`──────────────`);
          lines.push(`토탈 ${grand.pct}%`);
          const text = lines.join("\n");
          return (
            <>
              <div style={{ background: S.inputBg, borderRadius: 10, padding: "12px 14px", marginBottom: 10, fontSize: 12, lineHeight: 1.8, color: S.textSub, fontFamily: "monospace", whiteSpace: "pre-wrap", border: `1px solid ${S.border}` }}>{text}</div>
              <button onClick={() => { navigator.clipboard.writeText(text).then(() => setCopied(true)); setTimeout(() => setCopied(false), 2000); }}
                style={{ width: "100%", background: copied ? "#059669" : "linear-gradient(135deg,#1e40af,#7c3aed)", border: "none", borderRadius: 8, padding: "10px 0", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 700, marginBottom: 14, boxShadow: "0 2px 8px rgba(37,99,235,0.25)" }}>
                {copied ? "✓ 복사됨!" : "📤 현황 공유"}
              </button>
            </>
          );
        })()}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* 불출완료 */}
          {(() => {
            const bulDone = ZONES.filter(z => zoneTotals[z].pct === 100 && !data[z].picking);
            if (!bulDone.length) return null;
            return (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <div>
                  <div style={{ fontSize: 11, color: "#15803d", fontWeight: 700, marginBottom: 2 }}>불출완료</div>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>
                    {bulDone.map((z,i) => <span key={z}><span style={{ color: ZONE_COLORS[z] }}>{z.length<=1?z+"존":z}</span>{i<bulDone.length-1&&<span style={{ color: "#94a3b8" }}> · </span>}</span>)}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 13, color: "#15803d", fontWeight: 800 }}>{bulDone.length}개 존</div>
              </div>
            );
          })()}

          {/* 피킹완료 */}
          {(() => {
            const pickDone = ZONES.filter(z => data[z].picking);
            if (!pickDone.length) return null;
            return (
              <div style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>🟡</span>
                <div>
                  <div style={{ fontSize: 11, color: "#a16207", fontWeight: 700, marginBottom: 2 }}>피킹완료</div>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>
                    {pickDone.map((z,i) => <span key={z}><span style={{ color: ZONE_COLORS[z] }}>{z.length<=1?z+"존":z}</span>{i<pickDone.length-1&&<span style={{ color: "#94a3b8" }}> · </span>}</span>)}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 13, color: "#a16207", fontWeight: 800 }}>{pickDone.length}개 존</div>
              </div>
            );
          })()}

          {/* 진행중 */}
          {ZONES.filter(z => !data[z].picking && zoneTotals[z].pct < 100).map(z => {
            const { done, pct } = zoneTotals[z];
            return (
              <div key={z} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ZONE_COLORS[z], minWidth: 32, textAlign: "center" }}>{z}</div>
                <div style={{ flex: 1, height: 8, background: "#e2e8f0", borderRadius: 4 }}>
                  <div style={{ height: 8, borderRadius: 4, background: `linear-gradient(90deg,${ZONE_COLORS[z]},${ZONE_COLORS[z]}99)`, width: `${pct}%`, transition: "width 0.4s" }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, minWidth: 40, textAlign: "right", color: S.text }}>{pct}%</div>
                <div style={{ fontSize: 11, color: S.textSub, minWidth: 80, textAlign: "right" }}>{done} / {totalBatches}배치</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 초기화 버튼 - 맨 아래 */}
      <button onClick={resetAll} style={{ width: "100%", background: S.card, border: `1px solid #fecaca`, borderRadius: 12, padding: "12px 0", cursor: "pointer", color: "#dc2626", fontSize: 13, fontWeight: 600, marginTop: 16, boxShadow: S.shadow, fontFamily: "inherit", letterSpacing: "0.05em" }}>🔄 전체 초기화</button>
    </div>
  );
}
