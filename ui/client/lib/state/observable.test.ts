import {describe, expect, it, vi} from 'vitest';
import {observable, _listenersOf} from './observable';

describe('observable()', () => {
    it('notifies listeners on field assignment', () => {
        class VM { count = 0 }
        const vm = observable(new VM());
        const cb = vi.fn();
        _listenersOf(vm)!.add(cb);
        vm.count = 1;
        expect(cb).toHaveBeenCalledTimes(1);
        vm.count = 2;
        expect(cb).toHaveBeenCalledTimes(2);
    });

    it('skips notification when assigned value is identical (Object.is)', () => {
        class VM { count = 0; tag: string | null = null }
        const vm = observable(new VM());
        const cb = vi.fn();
        _listenersOf(vm)!.add(cb);
        vm.count = 0;     // same → no notify
        vm.tag = null;    // same → no notify
        expect(cb).not.toHaveBeenCalled();
        vm.count = 1;
        expect(cb).toHaveBeenCalledTimes(1);
    });

    it('auto-binds method access — `vm.method` is a stable bound ref', async () => {
        class VM {
            n = 0;
            async inc() { this.n += 1; }
        }
        const vm = observable(new VM());
        const ref1 = vm.inc;
        const ref2 = vm.inc;
        await ref1();
        await ref2();
        expect(vm.n).toBe(2);
    });

    it('is idempotent — wrapping twice returns the same observable', () => {
        class VM { x = 1 }
        const a = observable(new VM());
        const b = observable(a);
        expect(b).toBe(a);
    });

    it('survives a listener that throws — others still notified', () => {
        class VM { x = 0 }
        const vm = observable(new VM());
        const good = vi.fn();
        _listenersOf(vm)!.add(() => { throw new Error('bad'); });
        _listenersOf(vm)!.add(good);
        vm.x = 1;
        expect(good).toHaveBeenCalled();
    });
});
