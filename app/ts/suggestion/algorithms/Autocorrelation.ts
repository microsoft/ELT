import {ComplexArray, fft} from './fft';


function nextPowerOf2(n: number): number {
    let s = 1;
    while (s < n) {
        s = s << 1;
    }
    return s;
}

export class Autocorrelation {
    private _array: ComplexArray;
    private _windowSize: number;
    private _inWindowSize: number;
    private _FFTSize: number;
    private _windowFunction: Float32Array;

    constructor(windowSize: number) {
        this._windowSize = windowSize;
        this._inWindowSize = windowSize;
        this._FFTSize = nextPowerOf2(this._inWindowSize * 2);

        this._windowFunction = new Float32Array(this._inWindowSize);
        for (let i = 0; i < this._inWindowSize; i++) {
            const t = i / (this._inWindowSize - 1);
            this._windowFunction[i] = Math.cos((t - 0.5) * Math.PI);
        }

        this._array = {
            re: new Float32Array(this._FFTSize),
            im: new Float32Array(this._FFTSize),
        };
    }

    public get inWindowSize(): number { return this._inWindowSize; }

    public compute(data: Float32Array, output: Float32Array, subtractMean: boolean = true): void {
        const dre = this._array.re;
        const dim = this._array.im;
        let dataMean = 0;
        if (subtractMean) {
            for (let i = 0; i < this._inWindowSize; i++) {
                dataMean += data[i] * this._windowFunction[i];
            }
            dataMean /= this._inWindowSize;
        }
        // Zero pad to the next power of 2.
        for (let i = 0; i < this._FFTSize; i++) {
            dre[i] = i < this._inWindowSize ? (data[i] - dataMean) * this._windowFunction[i] : 0;
            dim[i] = 0;
        }
        // FFT.
        fft(this._array, false);
        // Remove DC component.
        // dre[0] = dim[0] = 0;
        // Multiply each element by its complex conjugate.
        for (let i = 0; i < this._FFTSize; i++) {
            dre[i] = dre[i] * dre[i] + dim[i] * dim[i];
            dim[i] = 0;
        }
        fft(this._array, true);
        for (let i = 0; i < this._windowSize; i++) {
            output[i] = dre[i];
        }
    }
}

export function autocorrelogram(signal: Float32Array, windowSize: number, sliceSize: number, subtractMean: boolean = true): Float32Array {
    const autocorrelation = new Autocorrelation(windowSize);
    let numSlices = 0;
    const inWindowSize = autocorrelation.inWindowSize;
    for (let i = 0; i + inWindowSize < signal.length; i += sliceSize) { numSlices += 1; }

    const outputBuffer = new Float32Array(numSlices * windowSize);

    let sliceIndex = 0;
    for (let i = 0; i + inWindowSize < signal.length; i += sliceSize) {
        autocorrelation.compute(
            signal.subarray(i, i + inWindowSize),
            outputBuffer.subarray(sliceIndex * windowSize, sliceIndex * windowSize + windowSize),
            subtractMean);
        sliceIndex += 1;
    }
    return outputBuffer;
}
