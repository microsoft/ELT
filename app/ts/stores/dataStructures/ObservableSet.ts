import { action, computed, observable, ObservableMap } from 'mobx';


export class ObservableSet<T> {
    private map: ObservableMap<boolean>;
    private keyMap: Map<string, T>;

    constructor(private getKey: (item: T) => string) {
        this.map = observable.map<boolean>();
        this.keyMap = new Map<string, T>();
    }

    @action public add(item: T): ObservableSet<T> {
        const key = this.getKey(item);
        this.keyMap[key] = item;
        this.map.set(key, true);
        return this;
    }

    public has(item: T): boolean {
        return this.keyMap.has(this.getKey(item));
    }

    @action public remove(item: T): ObservableSet<T> {
        const key = this.getKey(item);
        this.keyMap.delete(key);
        this.map.delete(key);
        return this;
    }

    @action public clear(): ObservableSet<T> {
        this.map.clear();
        this.keyMap.clear();
        return this;
    }

    @computed public get size(): number {
        return this.map.size;
    }

    @computed public get items(): T[] {
        const result = [];
        // It's important to read map here so that reactions will happen,
        // even though the method could be written only with keyMap.
        this.map.forEach((_, key) => result.push(this.keyMap[key]));
        return result;
    }

    public forEach(callback: (item: T) => void): void {
        this.keyMap.forEach(callback);
    }
}

