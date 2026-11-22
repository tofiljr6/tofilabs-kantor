import { flagCode } from "@/lib/currencies";

export default function Flag({ symbol }: { symbol: string }) {
  const code = flagCode(symbol);
  if (!code) return <span className="flag flag-empty" aria-hidden />;
  return <span className={`flag fi fi-${code}`} aria-hidden />;
}
