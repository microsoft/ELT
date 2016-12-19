import {EventEmitter} from 'events';


export class NodeEvent {
    constructor(private emitter: EventEmitter, private name: string) {
    }
    public emit(): void {
        this.emitter.emit(this.name);
    }
    public on(callback: Function): void {
        this.emitter.addListener(this.name, callback);
    }
    public off(callback: Function): void {
        this.emitter.removeListener(this.name, callback);
    }
}


export class NodeItemEvent<T> {
    private _listeners: WeakMap<T, Set<Function>>;

    constructor() {
        this._listeners = new WeakMap<T, Set<Function>>();
    }

    public on(item: T, listener: Function): void {
        let items: Set<Function>;
        if (this._listeners.has(item)) {
            items = this._listeners.get(item);
        } else {
            items = new Set<Function>();
            this._listeners.set(item, items);
        }
        items.add(listener);
    }

    public off(item: T, listener: Function): void {
        if (this._listeners.has(item)) {
            this._listeners.get(item).delete(listener);
        }
    }

    public emit(item: T, ...args: any[]): void {
        if (this._listeners.has(item)) {
            this._listeners.get(item).forEach((x) => x(...args));
        }
    }
}
