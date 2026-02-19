export function generateDeck(){
  const m = [];
  for (let i = 1; i <= 12; i++) for (let j = 0; j < i; j++) m.push({ type:"number", value:i });

  for (let k = 0; k < 3; k++){
    m.push({ type:"special", value:"FREEZE" });
    m.push({ type:"special", value:"2ndCHANCE" });
    m.push({ type:"special", value:"FLIP3" });
  }

  [2,3,4,6,8,10].forEach(v => m.push({ type:"plus", value:v }));
  m.push({ type:"mult", value:"x2" });

  for (let i = m.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [m[i], m[j]] = [m[j], m[i]];
  }
  return m;
}

export function pointsFromCards(cards){
  let base = 0, bonus = 0, mult = 1;
  cards.forEach(c => {
    if (c.type === "number") base += c.value;
    else if (c.type === "plus") bonus += c.value;
    else if (c.type === "mult") mult *= 2;
  });
  return base * mult + bonus;
}

export function cardLabel(c){
  if (!c) return "?";
  if (c.type === "plus") return `+${c.value}`;
  if (c.type === "mult") return "x2";
  if (c.type === "special"){
    if (c.value === "FREEZE") return "❄️";
    if (c.value === "FLIP3") return "🎁";
    if (c.value === "2ndCHANCE") return "🛡️";
  }
  return String(c.value);
}

export function iconFor(tipo){
  if (tipo === "FREEZE") return "❄️";
  if (tipo === "FLIP3") return "🎁";
  if (tipo === "2ndCHANCE") return "🛡️";
  return "✨";
}
