// casino.js — casino mini-games on the strip: slots, roulette,
// blackjack, and the high-roller table (minimum bet $1,000, used in M38).
// Factory: createCasino(scene, world) or createCasino(world).
// Winnings total is tracked in world.viceState.casinoWinnings and shown
// on the HUD. All odds are real in-game odds; nothing costs real money.

function notify(world, text) {
  if (!world) return;
  if (typeof world.toast === 'function') { world.toast(text); return; }
  if (Array.isArray(world.events)) world.events.push({ type: 'toast', text });
  if (world.hud && typeof world.hud.toast === 'function') world.hud.toast(text);
}

function ensureState(world) {
  if (!world.viceState) {
    world.viceState = {
      casinoRigged: false, highRollerWon: false,
      havanaRunDone: false, viceKingCrowned: false,
      casinoWinnings: 0, leaguePoints: 0, leagueWins: 0, nightclubIncome: 0,
    };
  }
  if (typeof world.cash !== 'number') world.cash = 0;
  return world.viceState;
}

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function cardValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c === 1) { aces += 1; total += 11; }
    else if (c >= 10) total += 10;
    else total += c;
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

export function createCasino(scene, world) {
  const w = world || scene;
  ensureState(w);
  const state = {
    slotsSpins: 0,
    rouletteSpins: 0,
    blackjackHands: 0,
    highRollerHands: 0,
    lastResult: null,
  };

  function recordWin(amount) {
    const s = ensureState(w);
    s.casinoWinnings += amount;
    return s.casinoWinnings;
  }

  function recordLoss(amount) {
    const s = ensureState(w);
    s.casinoWinnings -= amount;
    return s.casinoWinnings;
  }

  function playSlots(bet) {
    const stake = bet || 50;
    if (w.cash < stake) { notify(w, 'Not enough cash for a slots spin.'); return null; }
    w.cash -= stake;
    state.slotsSpins += 1;
    const reels = [randInt(7), randInt(7), randInt(7)];
    let payout = 0;
    // Three of a kind pays 10x; a pair pays 2x; three 7s pay a 25x jackpot.
    if (reels[0] === 6 && reels[1] === 6 && reels[2] === 6) payout = stake * 25;
    else if (reels[0] === reels[1] && reels[1] === reels[2]) payout = stake * 10;
    else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) payout = stake * 2;
    w.cash += payout;
    const net = payout - stake;
    if (net > 0) recordWin(net); else if (net < 0) recordLoss(-net);
    const result = { game: 'slots', bet: stake, reels, payout, net };
    state.lastResult = result;
    notify(w, payout > 0 ? 'Slots: [' + reels.join(' ') + '] — you win $' + payout + '!' : 'Slots: [' + reels.join(' ') + '] — no win.');
    return result;
  }

  function playRoulette(bet, pick) {
    const stake = bet || 100;
    if (w.cash < stake) { notify(w, 'Not enough cash for a roulette bet.'); return null; }
    const chosen = typeof pick === 'number' ? pick : randInt(37);
    w.cash -= stake;
    state.rouletteSpins += 1;
    const ball = randInt(37);
    const rigged = !!(w.viceState && w.viceState.casinoRigged);
    // Rigged wheel (M37): the ball favours Rico's number.
    const landed = rigged && Math.random() < 0.5 ? chosen : ball;
    const won = landed === chosen;
    const payout = won ? stake * 35 : 0;
    w.cash += payout;
    const net = payout - stake;
    if (net > 0) recordWin(net); else if (net < 0) recordLoss(-net);
    const result = { game: 'roulette', bet: stake, pick: chosen, landed, payout, net, won };
    state.lastResult = result;
    notify(w, won ? 'Roulette: ball lands on ' + landed + ' — you win $' + payout + '!' : 'Roulette: ball lands on ' + landed + ', not ' + chosen + '.');
    return result;
  }

  function playBlackjack(bet, standAt) {
    const stake = bet || 100;
    if (w.cash < stake) { notify(w, 'Not enough cash for blackjack.'); return null; }
    w.cash -= stake;
    state.blackjackHands += 1;
    const player = [randInt(13) + 1, randInt(13) + 1];
    const dealer = [randInt(13) + 1, randInt(13) + 1];
    const stopAt = typeof standAt === 'number' ? standAt : 17;
    while (cardValue(player) < stopAt) player.push(randInt(13) + 1);
    while (cardValue(dealer) < 17) dealer.push(randInt(13) + 1);
    const pv = cardValue(player);
    const dv = cardValue(dealer);
    let payout = 0;
    if (pv > 21) payout = 0;
    else if (dv > 21 || pv > dv) payout = stake * 2;
    else if (pv === dv) payout = stake;
    w.cash += payout;
    const net = payout - stake;
    if (net > 0) recordWin(net); else if (net < 0) recordLoss(-net);
    const result = { game: 'blackjack', bet: stake, player, dealer, playerValue: pv, dealerValue: dv, payout, net };
    state.lastResult = result;
    notify(w, 'Blackjack: you ' + pv + ', dealer ' + dv + (payout > stake ? ' — you win $' + (payout - stake) + '!' : payout === stake ? ' — push.' : ' — dealer wins.'));
    return result;
  }

  function playHighRoller(bet, game) {
    const stake = bet || 1000;
    if (stake < 1000) { notify(w, 'High-roller table: minimum bet $1,000.'); return null; }
    if (w.cash < stake) { notify(w, 'Not enough cash for the high-roller table.'); return null; }
    state.highRollerHands += 1;
    const kind = game || 'blackjack';
    if (kind === 'roulette') return playRoulette(stake, randInt(37));
    // High-roller blackjack uses a luckier shoe for the story beat (M38).
    const result = playBlackjack(stake, 18);
    if (result) result.highRoller = true;
    return result;
  }

  const api = {
    name: 'casino',
    state,
    playSlots,
    playRoulette,
    playBlackjack,
    playHighRoller,
    winnings() { return ensureState(w).casinoWinnings; },
    update(dt) {
      // Casino games are event-driven (player presses a key at a table);
      // update only keeps the winnings total in sync with the vice state.
      ensureState(w);
    },
  };
  if (Array.isArray(w.systems)) w.systems.push(api);
  return api;
}

export default createCasino;
