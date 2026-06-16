export const fmtDb = (n: number) => (isFinite(n) ? `${n.toFixed(1)} dBFS` : '-∞ dBFS');
export const fmtSec = (s: number) => `${s.toFixed(1)}s`;
export const fmtPct = (n: number) => `${n.toFixed(4)}%`;

export const fmtTime = (s: number): string => {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${sec.toFixed(1).padStart(4,'0')}`;
};

export const fmtTimeSec = (s: number): string => {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

export const fmtHM = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};
