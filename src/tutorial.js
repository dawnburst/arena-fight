// Scripted, interactive onboarding tutorial.
//
// The whole flow is prepared in advance as plain data (TUTORIAL_SCRIPT) and a
// small framework-agnostic sequencer (TutorialController) so it is unit-testable
// without Phaser. GameScene reads each step's `goal` to set up the scenario and
// detect when the player has actually performed the action.
//
// Per step the flow is: show the explanation panel (game frozen) → player
// acknowledges → player performs the goal in the live arena → advance.

// Goal types interpreted by GameScene:
//   move   — travel `amount` pixels
//   kill   — destroy `amount` target dummies (stationary, spawned for the step)
//   dash   — perform one dash
//   combo  — reach combo x`amount`
//   coin   — collect `amount` coins
//   gift   — collect the green gift
//   shield — collect the gold shield
//   ack    — informational only; acknowledging the panel completes the step
export const TUTORIAL_SCRIPT = [
  {
    id: 'move',
    title: 'MOVEMENT',
    body: 'Use WASD or the arrow keys to move.\nOn touch, use the left stick.',
    task: 'Move around the arena',
    success: 'Nice — you can move!',
    goal: { type: 'move', amount: 180 },
  },
  {
    id: 'aim-fire',
    title: 'AIM & FIRE',
    body: 'Aim with the mouse and hold the left button to fire.\nOn touch, the right stick aims and fires automatically.',
    task: 'Destroy the target dummy',
    success: 'Great shot!',
    goal: { type: 'kill', amount: 1 },
  },
  {
    id: 'dash',
    title: 'DASH',
    body: 'Press Space to dash a short distance.\nYou are briefly invulnerable while dashing — use it to dodge.',
    task: 'Perform a dash',
    success: 'Dash unlocked!',
    goal: { type: 'dash', amount: 1 },
  },
  {
    id: 'combo',
    title: 'COMBO',
    body: 'Chaining kills without getting hit raises your combo (top-right).\nA higher combo multiplies both score and coins.',
    task: 'Destroy all 3 targets',
    success: 'Combo x3! Keep your chains alive for big rewards.',
    goal: { type: 'combo', amount: 3 },
  },
  {
    id: 'coin',
    title: 'COINS',
    body: 'Enemies drop coins. Coins bank to your wallet and are\nspent in the Store between runs to buy weapons and mods.',
    task: 'Collect the coins',
    success: 'Collected! Spend coins in the Store later.',
    goal: { type: 'coin', amount: 5 },
  },
  {
    id: 'gift',
    title: 'GREEN GIFT',
    body: 'The green gift grants a temporary bonus mod\nthat boosts your fighter for a short time.',
    task: 'Grab the green gift',
    success: 'Powered up!',
    goal: { type: 'gift', amount: 1 },
  },
  {
    id: 'shield',
    title: 'GOLD SHIELD',
    body: 'The gold shield absorbs the next 5 hits over 20 seconds,\nand pays out coins for any hits you do not use.',
    task: 'Grab the gold shield',
    success: 'Shielded!',
    goal: { type: 'shield', amount: 1 },
  },
  {
    id: 'boss',
    title: 'BOSSES',
    body: 'Every 10th wave is a boss with a shield and glowing\nweak points. Hit the weak points to break the shield,\nthen damage the core.',
    task: 'Got it!',
    success: "You're ready — good luck in the arena!",
    goal: { type: 'ack' },
  },
];

// Drives the explain → act → next sequence. Pure: GameScene calls acknowledge()
// when the player dismisses a panel and complete() when the goal is met.
export class TutorialController {
  constructor(steps = TUTORIAL_SCRIPT) {
    this.steps = Array.isArray(steps) ? steps : [];
    this.index = 0;
    // 'explain' — panel up, waiting for acknowledge
    // 'act'     — waiting for the player to complete the goal
    // 'done'    — every step finished
    this.phase = this.steps.length ? 'explain' : 'done';
  }

  current() {
    return this.steps[this.index] || null;
  }

  // Dismiss the explanation panel. Informational ('ack') steps complete
  // immediately; everything else moves to the action phase.
  acknowledge() {
    if (this.phase !== 'explain') return this.phase;
    const step = this.current();
    if (step?.goal?.type === 'ack') return this.complete();
    this.phase = 'act';
    return this.phase;
  }

  // Mark the current goal complete and advance (or finish the tutorial).
  complete() {
    if (this.phase === 'done') return this.phase;
    if (this.index >= this.steps.length - 1) {
      this.phase = 'done';
    } else {
      this.index += 1;
      this.phase = 'explain';
    }
    return this.phase;
  }

  isFinished() {
    return this.phase === 'done';
  }
}
