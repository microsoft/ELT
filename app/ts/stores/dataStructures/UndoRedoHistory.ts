// Snapshot-based Undo/Redo logic.

// The structure is this:
//    u3 - u2 - u1 - [ current ] - r1 - r2 - r3
// The current state is the state of the app (not in the HistoryTracker).
// The history tracker stores states before the current state, and states after the current state (in case of redo).
// The states after the current state is cleared when adding a new action
// (this means users can't redo after doing something after undo).
// The states before the current state is always saved.
//
// The usage is:
// When a user action happened, BEFORE making changes, take a snapshot and call .add().
// When undo, take a snapshot, call undo(currentSnapshot). 
// If the history is not empty, the function will return the previous snapshot, 
// and save curerntSnapeshot in the redo history.
// If the returned snapshot is null, which means history is empty, stop because we can't undo.
// Otherwise, load the saved snapshot.
// When redo, (the same except calling redo).
//
// Call reset when the history need to be discarded completely. 

// Snapshots need to be decoupled
// - They shouldn't reference to the same object which can be updated by the app.
// - Referencing to the same object is okay (and save space) if the object never changes.
import { action, computed, observable } from 'mobx';

export class UndoRedoHistory<TSnapshot> {
    @observable private _undoHistory: TSnapshot[];
    @observable private _redoHistory: TSnapshot[];

    constructor() {
        this._undoHistory = [];
        this._redoHistory = [];
    }

    @action public add(item: TSnapshot): void {
        this._undoHistory.push(item);
        this._redoHistory = [];
    }

    @action public undo(current: TSnapshot): TSnapshot {
        const lastIndex = this._undoHistory.length - 1;
        if (lastIndex >= 0) {
            const [lastItem] = this._undoHistory.splice(lastIndex, 1);
            this._redoHistory.push(current);
            return lastItem;
        } else {
            return null;
        }
    }

    @action public redo(current: TSnapshot): TSnapshot {
        const lastIndex = this._redoHistory.length - 1;
        if (lastIndex >= 0) {
            const [lastItem] = this._redoHistory.splice(lastIndex, 1);
            this._undoHistory.push(current);
            return lastItem;
        } else {
            return null;
        }
    }

    @computed public get canUndo(): boolean {
        return this._undoHistory.length > 0;
    }

    @computed public get canRedo(): boolean {
        return this._redoHistory.length > 0;
    }

    @action public reset(): void {
        this._undoHistory = [];
        this._redoHistory = [];
    }
}
