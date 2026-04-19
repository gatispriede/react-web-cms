import {useEffect, useState} from 'react';

export interface UndoTicket {
    /** Short human label shown in the status pill / tooltip. */
    label: string;
    /** Reverse the mutation. */
    undo: () => Promise<void>;
    /** Re-apply the mutation after an undo. Optional — tickets without redo fall off the redo stack. */
    redo?: () => Promise<void>;
}

const MAX_DEPTH = 20;

class UndoStack {
    private stack: UndoTicket[] = [];
    private redoStack: UndoTicket[] = [];
    private subs = new Set<() => void>();

    push(ticket: UndoTicket): void {
        this.stack.push(ticket);
        if (this.stack.length > MAX_DEPTH) this.stack.shift();
        this.redoStack = [];
        this.emit();
    }

    async undo(): Promise<void> {
        const ticket = this.stack.pop();
        if (!ticket) return;
        try {
            await ticket.undo();
        } catch (err) {
            console.error('undo failed:', err);
            this.stack.push(ticket);
            this.emit();
            return;
        }
        if (ticket.redo) this.redoStack.push(ticket);
        this.emit();
    }

    async redo(): Promise<void> {
        const ticket = this.redoStack.pop();
        if (!ticket || !ticket.redo) return;
        try {
            await ticket.redo();
        } catch (err) {
            console.error('redo failed:', err);
            this.redoStack.push(ticket);
            this.emit();
            return;
        }
        this.stack.push(ticket);
        this.emit();
    }

    clear(): void {
        this.stack = [];
        this.redoStack = [];
        this.emit();
    }

    size(): number { return this.stack.length; }
    redoSize(): number { return this.redoStack.length; }
    peek(): UndoTicket | undefined { return this.stack[this.stack.length - 1]; }

    subscribe(fn: () => void): () => void {
        this.subs.add(fn);
        return () => { this.subs.delete(fn); };
    }

    private emit(): void {
        this.subs.forEach(fn => fn());
    }
}

export const undoStack = new UndoStack();

/** Re-render on every push/undo/redo so status pills stay live. */
export function useUndoStack(): {size: number; redoSize: number; lastLabel?: string} {
    const [, force] = useState(0);
    useEffect(() => undoStack.subscribe(() => force(n => n + 1)), []);
    return {
        size: undoStack.size(),
        redoSize: undoStack.redoSize(),
        lastLabel: undoStack.peek()?.label,
    };
}

/**
 * Wires global Cmd/Ctrl-Z to `undoStack.undo` and Cmd/Ctrl-Shift-Z to redo.
 * Ignores the hotkey when focus is on an editable surface so native undo
 * inside `<input>`/`<textarea>`/contenteditable keeps working.
 */
export function useUndoHotkey(enabled = true): void {
    useEffect(() => {
        if (!enabled) return;
        const onKey = (e: KeyboardEvent) => {
            const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
            const mod = isMac ? e.metaKey : e.ctrlKey;
            if (!mod || e.key.toLowerCase() !== 'z') return;
            const target = e.target as HTMLElement | null;
            if (target) {
                const tag = target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
            }
            e.preventDefault();
            if (e.shiftKey) void undoStack.redo();
            else void undoStack.undo();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [enabled]);
}
