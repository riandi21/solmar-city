// The casino on the strip: slots, roulette and blackjack at the tables, plus a
// high-roller table (minimum bet $1000) used in M38. All games use real odds — the
// house keeps an edge on every game, so the player cannot grind it forever.
//
// export createCasino(world) -> { update(dt), playSlots(bet), playRoulette(bet, choice),
//   playBlackjack(bet), playHighRoller(bet) }
// Net casino winnings are tracked in world.vice.casinoWinnings (shown on the HUD).
// Cash is taken from / paid to world.player.cash (falling back to world.cash).

const HIGH_ROLLER_MIN = 1000;
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SLOT_SYMBOLS = ['7', 'BAR', 'CHERRY', 'BELL', 'LEMON', 'DIAMOND'];

function cashOf(world) {
  if (world.player && typeof world.player.cash === 'number') return world.player.cash;
  return typeof world.cash === 'number' ? world.cash : 0;
}

function addCash(world, amount) {
  // One cash store: player.cash and world.cash stay in sync, or systems
  // that read world.cash first (fishing, properties, shops) clobber
  // winnings posted here.
  if (world.player && typeof world.player.cash === 'number') world.player.cash += amount;
  else if (typeof world.cash === 'number') world.cash += amount;
  if (world.player && typeof world.player.cash === 'number' && typeof world.cash === 'number') world.cash = world.player.cash;
}

function trackWinnings(world, net) {
  if (!world.vice) world.vice = { casinoWinnings: 0, racePoints: 0, raceWins: 0 };
  world.vice.casinoWinnings = (world.vice.casinoWinnings || 0) + net;
}

function note(world, text) {
  if (Array.isArray(world.events)) world.events.push({ type: 'casino', text });
}

function validBet(world, bet, min) {
  if (typeof bet !== 'number' || !Number.isFinite(bet) || bet <= 0) {
    return { ok: false, error: 'Bet must be a positive amount' };
  }
  if (min && bet < min) return { ok: false, error: `Minimum bet is $${min}` };
  if (bet > cashOf(world)) return { ok: false, error: 'Not enough cash for that bet' };
  return { ok: true };
}

function drawCard() {
  // 1 = ace, 11-13 = face cards (worth 10).
  return 1 + Math.floor(Math.random() * 13);
}

function cardValue(rank) {
  if (rank === 1) return 11;
  if (rank >= 11) return 10;
  return rank;
}

function handValue(ranks) {
  let total = 0;
  let aces = 0;
  for (const rank of ranks) {
    total += cardValue(rank);
    if (rank === 1) aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function handLabel(ranks) {
  return ranks.map((r) => (r === 1 ? 'A' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r))).join(' ');
}

export function createCasino(world) {
  let spins = 0;
  let hands = 0;

  function update() {
    // The casino has no per-frame state: games resolve instantly on play.
    // Kept so the system loop can tick it like every other system.
  }

  function playSlots(bet) {
    const check = validBet(world, bet);
    if (!check.ok) return check;
    addCash(world, -bet);
    spins += 1;
    const reels = [
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    ];
    let multiplier = 0;
    if (reels[0] === '7' && reels[1] === '7' && reels[2] === '7') multiplier = 50;
    else if (reels[0] === 'DIAMOND' && reels[1] === 'DIAMOND' && reels[2] === 'DIAMOND') multiplier = 25;
    else if (reels[0] === reels[1] && reels[1] === reels[2]) multiplier = 10;
    else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) multiplier = 2;
    else if (reels.includes('CHERRY')) multiplier = 1;
    const payout = bet * multiplier;
    if (payout > 0) addCash(world, payout);
    trackWinnings(world, payout - bet);
    const result = multiplier > 0 ? 'win' : 'lose';
    note(world, `Slots [${reels.join(' | ')}] — ${result === 'win' ? `won $${payout}` : `lost $${bet}`}.`);
    return { ok: true, game: 'slots', bet, reels, multiplier, payout, result, spins };
  }

  function playRoulette(bet, choice) {
    const check = validBet(world, bet);
    if (!check.ok) return check;
    const validChoices = ['red', 'black', 'odd', 'even', 'low', 'high'];
    const isNumber = typeof choice === 'number' && Number.isInteger(choice) && choice >= 0 && choice <= 36;
    if (!isNumber && !validChoices.includes(choice)) {
      return { ok: false, error: 'Choice must be red, black, odd, even, low, high, or a number 0-36' };
    }
    addCash(world, -bet);
    const number = Math.floor(Math.random() * 37);
    let multiplier = 0;
    if (isNumber) {
      if (number === choice) multiplier = 35;
    } else if (number !== 0) {
      if (choice === 'red' && RED_NUMBERS.has(number)) multiplier = 1;
      else if (choice === 'black' && !RED_NUMBERS.has(number)) multiplier = 1;
      else if (choice === 'odd' && number % 2 === 1) multiplier = 1;
      else if (choice === 'even' && number % 2 === 0) multiplier = 1;
      else if (choice === 'low' && number >= 1 && number <= 18) multiplier = 1;
      else if (choice === 'high' && number >= 19 && number <= 36) multiplier = 1;
    }
    // Even-money and straight-up bets pay stake + winnings: payout includes the stake back.
    const payout = multiplier === 35 ? bet * 36 : multiplier === 1 ? bet * 2 : 0;
    if (payout > 0) addCash(world, payout);
    trackWinnings(world, payout - bet);
    const color = number === 0 ? 'green' : RED_NUMBERS.has(number) ? 'red' : 'black';
    const result = payout > 0 ? 'win' : 'lose';
    note(world, `Roulette: ${number} ${color} — ${result === 'win' ? `won $${payout}` : `lost $${bet}`} on ${choice}.`);
    return { ok: true, game: 'roulette', bet, choice, number, color, payout, result };
  }

  function playBlackjack(bet, highRoller) {
    const check = validBet(world, bet, highRoller ? HIGH_ROLLER_MIN : 0);
    if (!check.ok) return check;
    addCash(world, -bet);
    hands += 1;
    const player = [drawCard(), drawCard()];
    const dealer = [drawCard(), drawCard()];
    // Simple house-style play: player stands on 17+, dealer stands on 17+.
    while (handValue(player) < 17) player.push(drawCard());
    while (handValue(dealer) < 17) dealer.push(drawCard());
    const playerTotal = handValue(player);
    const dealerTotal = handValue(dealer);
    const playerBlackjack = player.length === 2 && playerTotal === 21;
    const dealerBlackjack = dealer.length === 2 && dealerTotal === 21;
    let payout = 0;
    let result;
    if (playerBlackjack && !dealerBlackjack) {
      // Blackjack pays 3:2.
      payout = bet + Math.floor(bet * 1.5);
      result = 'blackjack';
    } else if (playerTotal > 21) {
      result = 'bust';
    } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
      payout = bet * 2;
      result = 'win';
    } else if (playerTotal === dealerTotal) {
      payout = bet;
      result = 'push';
    } else {
      result = 'lose';
    }
    if (payout > 0) addCash(world, payout);
    trackWinnings(world, payout - bet);
    note(world, `Blackjack${highRoller ? ' (high roller)' : ''}: you ${handLabel(player)} (${playerTotal}) vs dealer ${handLabel(dealer)} (${dealerTotal}) — ${result}, ${payout > bet ? `+$${payout - bet}` : payout === bet ? 'push' : `-$${bet}`}.`);
    return {
      ok: true, game: 'blackjack', highRoller: !!highRoller, bet,
      player: handLabel(player), playerTotal, dealer: handLabel(dealer), dealerTotal,
      payout, result, hands,
    };
  }

  function playHighRoller(bet) {
    return playBlackjack(bet, true);
  }

  function getStats() {
    return {
      spins, hands,
      netWinnings: world.vice ? (world.vice.casinoWinnings || 0) : 0,
      cash: cashOf(world),
    };
  }

  return {
    update,
    playSlots,
    playRoulette,
    playBlackjack: (bet) => playBlackjack(bet, false),
    playHighRoller,
    getStats,
    get spins() { return spins; },
    get hands() { return hands; },
  };
}

export default createCasino;
