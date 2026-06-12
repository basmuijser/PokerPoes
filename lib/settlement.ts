import { Player } from "./types";

export interface NetBalance {
  playerId: string;
  name: string;
  net: number;
}

export interface Transaction {
  from: string;
  to: string;
  amount: number;
}

export function computeNetBalances(
  players: Player[],
  chipValue: number,
  moneyMode: boolean,
): NetBalance[] {
  return players.map((p) => {
    const netChips = p.chips - p.total_buyins;
    const net = moneyMode ? netChips * chipValue : netChips;
    return { playerId: p.id, name: p.name, net };
  });
}

export function settle(balances: NetBalance[]): Transaction[] {
  const eps = 0.005;
  const creditors = balances
    .filter((b) => b.net > eps)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.net - a.net);
  const debtors = balances
    .filter((b) => b.net < -eps)
    .map((b) => ({ ...b, net: -b.net }))
    .sort((a, b) => b.net - a.net);

  const out: Transaction[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amt = Math.min(d.net, c.net);
    out.push({
      from: d.name,
      to: c.name,
      amount: Math.round(amt * 100) / 100,
    });
    d.net -= amt;
    c.net -= amt;
    if (d.net < eps) i++;
    if (c.net < eps) j++;
  }
  return out;
}
