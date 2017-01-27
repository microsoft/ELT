export function computeMipmap(array: number[] | Float32Array): Float32Array {
    const length = Math.ceil(array.length / 2);
    const result = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        const p = i / (length - 1) * (array.length - 1);
        const i1 = Math.floor(p);
        const i2 = i1 + 1;
        const s = p - i1;
        if (array[i1] === array[i1] && array[i2] === array[i2]) {
            result[i] = array[i1] * (1 - s) + array[i2] * s;
        } else if (array[i1] === array[i1]) {
            // Deal with NaNs.
            result[i] = array[i1];
        } else {
            result[i] = array[i2];
        }
    }
    return result;
}

export function computeDimensionsMipmap(dimensions: (number[] | Float32Array)[]): Float32Array[] {
    return dimensions.map(computeMipmap);
}

export function computeDimensionsMipmapLevels(dimensions: (number[] | Float32Array)[]): Float32Array[][] {
    const levelCount = Math.floor(Math.log(dimensions[0].length) / Math.log(2) - 6);
    let dims = dimensions.map(x => new Float32Array(x));
    const levels = [dims];
    for (let i = 0; i < levelCount; i++) {
        dims = computeDimensionsMipmap(dims);
        levels.push(dims);
    }
    return levels;
}

export class MipmapCache {
    private _dimensions2Mipmap: WeakMap<(number[] | Float32Array)[], Float32Array[][]>;

    constructor() {
        this._dimensions2Mipmap = new WeakMap<(number[] | Float32Array)[], Float32Array[][]>();
    }

    public getMipmap(dimensions: (number[] | Float32Array)[]): Float32Array[][] {
        if (this._dimensions2Mipmap.has(dimensions)) {
            return this._dimensions2Mipmap.get(dimensions);
        } else {
            const r = computeDimensionsMipmapLevels(dimensions);
            this._dimensions2Mipmap.set(dimensions, r);
            return r;
        }
    }

    public getMipmapForLength(dimensions: (number[] | Float32Array)[], desiredLength: number): Float32Array[] {
        let level = Math.log(dimensions[0].length / desiredLength) / Math.log(2);
        level = Math.round(level);
        if (level < 0) { level = 0; }
        const mipmap = this.getMipmap(dimensions);
        if (level >= mipmap.length) { level = mipmap.length - 1; }
        return mipmap[level];
    }
}
