// On-screen twin-stick controls for touch devices. Left stick drives movement,
// right stick drives aim + auto-fire while held, plus dash / weapon-switch / pause
// buttons. GameScene reads intents through the getX()/consumeX() API so its
// gameplay logic stays input-agnostic. Anchored in the fixed 800x600 space; the
// Scale.FIT manager maps that to the device. Touch-mode only — never built on
// desktop, so the mouse/keyboard path is untouched.

const STICK_R = 70;
const DEADZONE = STICK_R * 0.2;
const LEFT_BASE = { x: 130, y: 470 };
const RIGHT_BASE = { x: 670, y: 470 };
const DASH_BTN = { x: 686, y: 300, r: 36, label: 'DASH' };
const SWITCH_BTN = { x: 114, y: 300, r: 30, label: 'SW' };
const PAUSE_BTN = { x: 762, y: 34, r: 24, label: '||' };
const BUTTONS = [DASH_BTN, SWITCH_BTN, PAUSE_BTN];

const DEPTH = 1000;

export default class TouchControls {
  constructor(scene) {
    this.scene = scene;

    // Ensure enough pointers for left stick + right stick + a button at once.
    scene.input.addPointer(2);

    this.leftId = null;
    this.rightId = null;
    this.leftVec = { x: 0, y: 0 }; // offset from base, clamped to STICK_R
    this.rightVec = { x: 0, y: 0 };

    this.dashLatched = false;
    this.pauseLatched = false;
    this.switchLatched = false;
    this.pressed = new Map(); // pointerId -> button (for press highlight)

    this.gfx = scene.add.graphics().setDepth(DEPTH).setScrollFactor(0).setAlpha(0.55);
    const labelStyle = {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      fontSize: '14px',
      color: '#ffffff',
    };
    this.labels = BUTTONS.map((btn) =>
      scene.add
        .text(btn.x, btn.y, btn.label, labelStyle)
        .setOrigin(0.5)
        .setDepth(DEPTH + 1)
        .setScrollFactor(0)
        .setAlpha(0.7),
    );

    this.onDown = this.handleDown.bind(this);
    this.onMove = this.handleMove.bind(this);
    this.onUp = this.handleUp.bind(this);
    scene.input.on('pointerdown', this.onDown);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    scene.input.on('pointerupoutside', this.onUp);

    this.draw();
  }

  hitButton(x, y) {
    for (const btn of BUTTONS) {
      if (Math.hypot(x - btn.x, y - btn.y) <= btn.r) return btn;
    }
    return null;
  }

  setStickFromPointer(side, px, py) {
    const base = side === 'left' ? LEFT_BASE : RIGHT_BASE;
    let dx = px - base.x;
    let dy = py - base.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) {
      dx = (dx / len) * STICK_R;
      dy = (dy / len) * STICK_R;
    }
    if (side === 'left') this.leftVec = { x: dx, y: dy };
    else this.rightVec = { x: dx, y: dy };
  }

  handleDown(pointer) {
    const { x, y } = pointer;
    const btn = this.hitButton(x, y);
    if (btn) {
      this.pressed.set(pointer.id, btn);
      if (btn === DASH_BTN) this.dashLatched = true;
      else if (btn === PAUSE_BTN) this.pauseLatched = true;
      else if (btn === SWITCH_BTN) this.switchLatched = true;
      return;
    }
    if (x < 400) {
      if (this.leftId === null) {
        this.leftId = pointer.id;
        this.setStickFromPointer('left', x, y);
      }
    } else if (this.rightId === null) {
      this.rightId = pointer.id;
      this.setStickFromPointer('right', x, y);
    }
  }

  handleMove(pointer) {
    if (pointer.id === this.leftId) this.setStickFromPointer('left', pointer.x, pointer.y);
    else if (pointer.id === this.rightId) this.setStickFromPointer('right', pointer.x, pointer.y);
  }

  handleUp(pointer) {
    if (pointer.id === this.leftId) {
      this.leftId = null;
      this.leftVec = { x: 0, y: 0 };
    } else if (pointer.id === this.rightId) {
      this.rightId = null;
      this.rightVec = { x: 0, y: 0 };
    }
    this.pressed.delete(pointer.id);
  }

  // --- Intent API consumed by GameScene -------------------------------------

  getMove() {
    if (this.leftId === null) return { x: 0, y: 0 };
    const { x, y } = this.leftVec;
    const len = Math.hypot(x, y);
    if (len < DEADZONE) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  }

  getAim() {
    if (this.rightId === null) return null;
    const { x, y } = this.rightVec;
    if (Math.hypot(x, y) < DEADZONE) return null;
    return Math.atan2(y, x);
  }

  isFiring() {
    return this.rightId !== null;
  }

  consumeDash() {
    const v = this.dashLatched;
    this.dashLatched = false;
    return v;
  }

  consumePause() {
    const v = this.pauseLatched;
    this.pauseLatched = false;
    return v;
  }

  consumeSwitch() {
    const v = this.switchLatched;
    this.switchLatched = false;
    return v;
  }

  // --- Rendering ------------------------------------------------------------

  update() {
    this.draw();
  }

  draw() {
    const g = this.gfx;
    g.clear();

    this.drawStick(g, LEFT_BASE, this.leftId !== null ? this.leftVec : null);
    this.drawStick(g, RIGHT_BASE, this.rightId !== null ? this.rightVec : null);

    for (const btn of BUTTONS) {
      const held = [...this.pressed.values()].includes(btn);
      g.fillStyle(held ? 0x69f0ae : 0x222a22, 0.6);
      g.fillCircle(btn.x, btn.y, btn.r);
      g.lineStyle(3, 0xb9d7b3, 0.9);
      g.strokeCircle(btn.x, btn.y, btn.r);
    }
  }

  drawStick(g, base, vec) {
    g.lineStyle(3, 0xb9d7b3, 0.8);
    g.strokeCircle(base.x, base.y, STICK_R);
    const tx = base.x + (vec ? vec.x : 0);
    const ty = base.y + (vec ? vec.y : 0);
    g.fillStyle(0x69f0ae, vec ? 0.7 : 0.4);
    g.fillCircle(tx, ty, 30);
  }

  destroy() {
    const input = this.scene.input;
    input.off('pointerdown', this.onDown);
    input.off('pointermove', this.onMove);
    input.off('pointerup', this.onUp);
    input.off('pointerupoutside', this.onUp);
    this.gfx.destroy();
    for (const label of this.labels) label.destroy();
  }
}
