import { describe, expect, it } from 'vitest';
import { TUTORIAL_SCRIPT, TutorialController } from '../src/tutorial.js';

describe('TUTORIAL_SCRIPT', () => {
  it('is a prepared, ordered list of steps covering the core moves', () => {
    const ids = TUTORIAL_SCRIPT.map((s) => s.id);
    expect(ids).toEqual(['move', 'aim-fire', 'dash', 'combo', 'coin', 'gift', 'shield', 'boss']);
  });

  it('every step has the fields GameScene relies on', () => {
    for (const step of TUTORIAL_SCRIPT) {
      expect(typeof step.title).toBe('string');
      expect(step.title.length).toBeGreaterThan(0);
      expect(typeof step.body).toBe('string');
      expect(typeof step.task).toBe('string');
      expect(typeof step.success).toBe('string');
      expect(step.goal && typeof step.goal.type).toBe('string');
    }
  });
});

describe('TutorialController', () => {
  it('starts on the first step in the explain phase', () => {
    const c = new TutorialController();
    expect(c.index).toBe(0);
    expect(c.phase).toBe('explain');
    expect(c.current().id).toBe('move');
    expect(c.isFinished()).toBe(false);
  });

  it('acknowledge on a normal step enters the act phase', () => {
    const c = new TutorialController([
      { id: 'a', goal: { type: 'move' } },
      { id: 'b', goal: { type: 'kill' } },
    ]);
    expect(c.acknowledge()).toBe('act');
    expect(c.phase).toBe('act');
    // acknowledging again while acting is a no-op
    expect(c.acknowledge()).toBe('act');
  });

  it('complete advances to the next step back in the explain phase', () => {
    const c = new TutorialController([
      { id: 'a', goal: { type: 'move' } },
      { id: 'b', goal: { type: 'kill' } },
    ]);
    c.acknowledge();
    expect(c.complete()).toBe('explain');
    expect(c.current().id).toBe('b');
    expect(c.phase).toBe('explain');
  });

  it('completing the last step finishes the tutorial', () => {
    const c = new TutorialController([{ id: 'only', goal: { type: 'move' } }]);
    c.acknowledge();
    expect(c.complete()).toBe('done');
    expect(c.isFinished()).toBe(true);
    // further calls are stable
    expect(c.complete()).toBe('done');
  });

  it('acknowledging an ack-goal step completes it immediately', () => {
    const c = new TutorialController([
      { id: 'info', goal: { type: 'ack' } },
      { id: 'next', goal: { type: 'move' } },
    ]);
    expect(c.acknowledge()).toBe('explain');
    expect(c.current().id).toBe('next');
  });

  it('an empty script is immediately done', () => {
    const c = new TutorialController([]);
    expect(c.isFinished()).toBe(true);
    expect(c.current()).toBe(null);
  });

  it('the real script runs end-to-end through acknowledge/complete', () => {
    const c = new TutorialController();
    let guard = 0;
    while (!c.isFinished() && guard++ < 100) {
      const phase = c.acknowledge();
      if (phase === 'act') c.complete();
    }
    expect(c.isFinished()).toBe(true);
    expect(guard).toBeLessThan(100);
  });
});
