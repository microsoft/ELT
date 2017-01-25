import { observable } from 'mobx';

// The set of prototypes to use for the DTW classifier

export interface ReferenceLabel {
  series: number[][];
  variance: number;
  className: string;
}

export class DtwModelStore  {
  @observable public prototypes: ReferenceLabel[];
  @observable public prototypeSampleRate: number;

  constructor() {
    this.prototypes = [];
    this.prototypeSampleRate = 30;
  }
}
