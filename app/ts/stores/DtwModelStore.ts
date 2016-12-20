// DtwModelStore
// The set of prototypes to use for the DTW classifier
import { EventEmitter } from 'events';

export interface ReferenceLabel {
  series: number[][];
  variance: number;
  className: string;
}

export class DtwModelStore extends EventEmitter {
  private _prototypes: ReferenceLabel[];
  private _prototypeSampleRate: number;
  public get prototypes(): ReferenceLabel[] { return this._prototypes; }
  public set prototypes(prototypes: ReferenceLabel[]) {
    this._prototypes = prototypes;
  }
  public get prototypeSampleRate(): number { return this._prototypeSampleRate; }
  public set prototypeSampleRate(prototypeSampleRate: number) {
    this._prototypeSampleRate = prototypeSampleRate;
  }
  constructor() {
    super();
    this._prototypes = [];
    this._prototypeSampleRate = 30;
  }
}
