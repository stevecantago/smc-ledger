import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEMBER_AVATARS_CHANGED_EVENT, readMemberAvatars, writeMemberAvatars } from './memberAvatars';

afterEach(() => vi.unstubAllGlobals());

describe('avatar synchronization', () => {
  it('notifies the header after a successful same-tab avatar change', () => {
    const target = new EventTarget();
    const stored = new Map<string, string>();
    vi.stubGlobal('window', Object.assign(target, {
      localStorage: { setItem: (key: string, value: string) => stored.set(key, value), getItem: (key: string) => stored.get(key) ?? null },
    }));
    const changed = vi.fn();
    target.addEventListener(MEMBER_AVATARS_CHANGED_EVENT, changed);
    expect(writeMemberAvatars({ member1: { type: 'preset', value: 'mother' } })).toBe(true);
    expect(changed).toHaveBeenCalledOnce();
    expect(readMemberAvatars()).toEqual({ member1: { type: 'preset', value: 'mother' } });
  });

  it('does not announce an avatar that failed to save', () => {
    const target = new EventTarget();
    vi.stubGlobal('window', Object.assign(target, {
      localStorage: { setItem: () => { throw new Error('storage unavailable'); } },
    }));
    const changed = vi.fn();
    target.addEventListener(MEMBER_AVATARS_CHANGED_EVENT, changed);
    expect(writeMemberAvatars({ member1: { type: 'preset', value: 'father' } })).toBe(false);
    expect(changed).not.toHaveBeenCalled();
  });
});
