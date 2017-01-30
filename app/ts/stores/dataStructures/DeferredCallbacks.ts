export class DeferredCallbacks {
    private _waitingCount: number;
    private _onComplete: () => void;

    constructor() {
        this._waitingCount = 0;
        this._onComplete = null;
    }

    public callback(): () => void {
        this._waitingCount += 1;
        return () => {
            this._waitingCount -= 1;
            this.triggerIfZero();
        };
    }

    private triggerIfZero(): void {
        if (this._waitingCount === 0) {
            if (this._onComplete) {
                this._onComplete();
                this._onComplete = null;
            }
        }
    }

    public onComplete(callback: () => void): void {
        this._onComplete = callback;
        this.triggerIfZero();
    }
}
