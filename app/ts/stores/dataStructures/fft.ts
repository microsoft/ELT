export type ComplexArray = { re: Float32Array, im: Float32Array };

// FFT code adapted from github: https://github.com/dntj/jsfft/blob/master/lib/fft.js, MIT License
// Converted to TypeScript.
export function fft(input: ComplexArray, inverse: boolean): ComplexArray {
    const n = input.re.length;
    if (n & (n - 1)) {
        throw new Error('Cannot handle size ' + n + ' currently');
        // return FFT_Recursive(input, inverse)
    } else {
        return fftPowerOf2(input, inverse);
    }
}

function fftPowerOf2(input: ComplexArray, inverse: boolean): ComplexArray {
    const n = input.re.length;

    const output = bitReverseComplexArray(input);
    const oRE = output.re;
    const oIM = output.im;

    // Loops go like O(n log n):
    //   width ~ log n; i,j ~ n
    // width of each sub-array for which we're iteratively calculating FFT.
    let width = 1;
    while (width < n) {
        const delFRE = Math.cos(Math.PI / width);
        const delFIM = (inverse ? -1 : 1) * Math.sin(Math.PI / width);
        for (let i = 0; i < n / (2 * width); i++) {
            let fRE = 1;
            let fIM = 0;
            for (let j = 0; j < width; j++) {
                const l_index = 2 * i * width + j;
                const r_index = l_index + width;

                const lRE = oRE[l_index];
                const lIM = oIM[l_index];

                const rRE = fRE * oRE[r_index] - fIM * oIM[r_index];
                const rIM = fIM * oRE[r_index] + fRE * oIM[r_index];

                oRE[l_index] = Math.SQRT1_2 * (lRE + rRE);
                oIM[l_index] = Math.SQRT1_2 * (lIM + rIM);
                oRE[r_index] = Math.SQRT1_2 * (lRE - rRE);
                oIM[r_index] = Math.SQRT1_2 * (lIM - rIM);

                const temp = fRE * delFRE - fIM * delFIM;
                fIM = fRE * delFIM + fIM * delFRE;
                fRE = temp;
            }
        }
        width <<= 1;
    }
    return output;
}

function bitReverseIndex(index: number, n: number): number {
    let bitreversed_index: number = 0;
    while (n > 1) {
        bitreversed_index <<= 1;
        bitreversed_index += index & 1;
        index >>= 1;
        n >>= 1;
    }
    return bitreversed_index;
}

function bitReverseComplexArray(array: ComplexArray): ComplexArray {
    const n = array.re.length;
    const flips = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        flips[i] = 0;
    }
    for (let i = 0; i < n; i++) {
        const r_i = bitReverseIndex(i, n);
        if (flips[i] || flips[r_i]) { continue; }

        let swap = array.re[r_i];
        array.re[r_i] = array.re[i];
        array.re[i] = swap;

        swap = array.im[r_i];
        array.im[r_i] = array.im[i];
        array.im[i] = swap;

        flips[i] = flips[r_i] = 1;
    }
    return array;
}
