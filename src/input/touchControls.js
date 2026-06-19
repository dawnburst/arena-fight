// On-screen twin-stick controls for touch devices. Left stick drives movement,
// right stick drives aim + auto-fire while held, plus dash / weapon-switch / pause
// buttons. GameScene reads intents through the getX()/consumeX() API so its
// gameplay logic stays input-agnostic. Anchors are computed from the live logical
// canvas size (sticks in the bottom corners, buttons on the edges, left/right
// split at width/2) and recomputed via layout() on resize. Touch-mode only —
// never built on desktop, so the mouse/keyboard path is untouched.

const STICK_R = 70;
const DEADZONE = STICK_R * 0.2;

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
    this.dashBtn = { x: 0, y: 0, r: 36, label: 'DASH', key: 'dash' };
    this.switchBtn = { x: 0, y: 0, r: 30, label: 'SW', key: 'switch' };
    this.pauseBtn = { x: 0, y: 0, r: 24, label: '||', key: 'pause' };
    this.buttons = [this.dashBtn, this.switchBtn, this.pauseBtn];
    this.labels = this.buttons.map((btn) =>
      scene.add
        .text(btn.x, btn.y, btn.label, labelStyle)
        .setOrigin(0.5)
        .setDepth(DEPTH + 1)
        .setScrollFactor(0)
        .setAlpha(0.7),
    );

    this.layout();

    this.onDown = this.handleDown.bind(this);
    this.onMove = this.handleMove.bind(this);
    this.onUp = this.handleUp.bind(this);
    scene.input.on('pointerdown', this.onDown);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    scene.input.on('pointerupoutside', this.onUp);

    this.draw();
  }

  // Anchors derived from the live logical canvas size, so the controls hug the
  // corners/edges on any resolution. Called from the constructor and from
  // GameScene.handleResize.
  layout() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.leftBase = { x: 130, y: h - 130 };
    this.rightBase = { x: w - 130, y: h - 130 };
    this.dashBtn.x = w - 114;
    this.dashBtn.y = h - 300;
    this.switchBtn.x = 114;
    this.switchBtn.y = h - 300;
    this.pauseBtn.x = w - 38;
    this.pauseBtn.y = 34;
    this.split = w / 2;
    if (this.labels) {
      this.labels.forEach((label, i) => {
        label.setPosition(this.buttons[i].x, this.buttons[i].y);
      });
    }
    this.draw();
  }

  hitButton(x, y) {
    for (const btn of this.buttons) {
      if (Math.hypot(x - btn.x, y - btn.y) <= btn.r) return btn;
    }
    return null;
  }

  setStickFromPointer(side, px, py) {
    const base = side === 'left' ? this.leftBase : this.rightBase;
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
    // Ignore taps that land on an on-screen UI button (the MENU/RESUME/EXIT
    // overlay buttons, depth >= 1500 — see sceneUtils.addTouchButton) so they
    // don't also start the movement/aim stick underneath.
    if (pointer.currentlyOver?.some((o) => o?.input && o.depth >= 1500)) {
      return;
    }
    const { x, y } = pointer;
    const btn = this.hitButton(x, y);
    if (btn) {
      this.pressed.set(pointer.id, btn);
      if (btn === this.dashBtn) this.dashLatched = true;
      else if (btn === this.pauseBtn) this.pauseLatched = true;
      else if (btn === this.switchBtn) this.switchLatched = true;
      return;
    }
    if (x < this.split) {
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
    if (!g || !this.leftBase) return;
    g.clear();

    this.drawStick(g, this.leftBase, this.leftId !== null ? this.leftVec : null);
    this.drawStick(g, this.rightBase, this.rightId !== null ? this.rightVec : null);

    for (const btn of this.buttons) {
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
