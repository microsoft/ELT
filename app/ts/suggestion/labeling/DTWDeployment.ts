// Generate DTW code for Arduino and Microbit.
import {resampleColumn} from '../../common/common';



const templateArduino = `// HOWTO-dtwDeployment.ts:
// Call setupRecognizer(0.2) first.
// Then, call String className = recognize(sample);
// "NONE" will be returned if nothing is detected.
// sample should be a float array, in the same order you put the training data in the tool.

struct DTWInfo {
    int dim;                        // The dimension of the signal.
    float* prototype;               // The data for the prototype.
    int* s;                         // Matching array: start points.
    float* d;                       // Matching array: distances.
    int prototypeSize;              // The length of the prototype.
    int t;                          // Current time in samples.
    float variance;                 // The variance.
    float bestMatchEndsAtTDistance; // The distance of the best match that ends at t.
    int bestMatchEndsAtTStart;      // The start of the best match that ends at t.
};

float DTWDistanceFunction(int dim, float* a, float* b) {
    int s = 0;
    for(int i = 0; i < dim; i++) {
        s += abs(a[i] - b[i]);
    }
    return s;
}

void DTWInit(struct DTWInfo* DTW, int dim, float* prototype, int prototypeSize, float variance) {
    DTW->dim = dim;
    DTW->prototypeSize = prototypeSize;
    DTW->prototype = prototype;
    DTW->d = new float[prototypeSize + 1];
    DTW->s = new int[prototypeSize + 1];
    DTW->t = 0;
    DTW->variance = variance;
    for(int i = 0; i <= prototypeSize; i++) {
        DTW->d[i] = 1e10;
        DTW->s[i] = 0;
    }
    DTW->d[0] = 0;
}

void DTWReset(struct DTWInfo* DTW) {
    for(int i = 0; i <= DTW->prototypeSize; i++) {
        DTW->d[i] = 1e10;
        DTW->s[i] = 0;
    }
    DTW->d[0] = 0;
}

void DTWFeed(struct DTWInfo* DTW, float* sample) {
    float* d = DTW->d;
    int* s = DTW->s;
    DTW->t += 1;
    d[0] = 0;
    s[0] = DTW->t;
    float dp = d[0];
    int sp = s[0];
    for(int i = 1; i <= DTW->prototypeSize; i++) {
        float dist = DTWDistanceFunction(DTW->dim, DTW->prototype + (i - 1) * DTW->dim, sample);
        float d_i_minus_1 = d[i - 1]; int s_i_minus_1 = s[i - 1];
        float d_i_p = d[i]; int s_i_p = s[i];
        float d_i_p_minus_1 = dp; int s_i_p_minus_1 = sp;
        dp = d[i];
        sp = s[i];
        if(d_i_minus_1 <= d_i_p && d_i_minus_1 <= d_i_p_minus_1) {
            d[i] = dist + d_i_minus_1;
            s[i] = s_i_minus_1;
        } else if(d_i_p <= d_i_minus_1 && d_i_p <= d_i_p_minus_1) {
            d[i] = dist + d_i_p;
            s[i] = s_i_p;
        } else {
            d[i] = dist + d_i_p_minus_1;
            s[i] = s_i_p_minus_1;
        }
    }
    DTW->bestMatchEndsAtTDistance = d[DTW->prototypeSize] / DTW->variance;
    DTW->bestMatchEndsAtTStart = s[DTW->prototypeSize];
    if(DTW->t - DTW->bestMatchEndsAtTStart > DTW->prototypeSize * 0.8 && DTW->t - DTW->bestMatchEndsAtTStart < DTW->prototypeSize * 1.2) {
    } else DTW->bestMatchEndsAtTDistance = 1e10;
}

%%GLOBAL%%

void setupRecognizer(float confidenceThreshold) {
    float threshold = sqrt(-2 * log(confidenceThreshold));
%%SETUP%%
}

void resetRecognizer() {
%%RESET%%
}

String recognize(float* sample) {
%%MATCH%%
    String minClass = "NONE";
    float minClassScore = 1e10;
%%MATCH_COMPARISON%%
    return minClass;
}
`;


const templateMicrobit = `// HOWTO:
// Call setupRecognizer() first.
// Then, call let className = recognize([ input.acceleration(Dimension.X), input.acceleration(Dimension.Y), input.acceleration(Dimension.Z) ]);
// "NONE" will be returned if nothing is detected.
// An example is at the end of this file.

// IMPORTANT: All number in microbit are integers.
function DTWDistanceFunction(dim: number, a: number[], astart: number, b: number[]) {
    let s = 0;
    for (let i = 0; i < dim; i++) {
        s += (a[i + astart] - b[i]) * (a[i + astart] - b[i]);
    }
    return Math.sqrt(s);
}
class DTWInfo {
    public dim: number;
    public prototype: number[];
    public s: number[];
    public d: number[];
    public prototypeSize: number;
    public t: number;
    public bestMatchEndsAtTDistance: number;
    // The distance of the best match that ends at t.
    public variance: number;
    // The variance computed.
    public bestMatchEndsAtTStart: number;
    // The start of the best match that ends at t.
    constructor(dim: number, prototype: number[], prototypeSize: number, variance: number) {
        this.dim = dim;
        this.prototypeSize = prototypeSize;
        this.prototype = prototype;
        this.d = %%ARRAY_INITIALIZATION%%;
        this.s = %%ARRAY_INITIALIZATION%%;
        this.t = 0;
        this.variance = variance;
        for (let i = 0; i <= prototypeSize; i++) {
            this.d[i] = 500000000;
            this.s[i] = 0;
        }
        this.d[0] = 0;
    }
    public feed(sample: number[]) {
        let d = this.d;
        let s = this.s;
        this.t += 1;
        d[0] = 0;
        s[0] = this.t;
        let dp = d[0];
        let sp = s[0];
        for (let i = 1; i <= this.prototypeSize; i++) {
            let dist = DTWDistanceFunction(this.dim, this.prototype, (i - 1) * this.dim, sample);
            let d_i_minus_1 = d[i - 1];
            let s_i_minus_1 = s[i - 1];
            let d_i_p = d[i];
            let s_i_p = s[i];
            let d_i_p_minus_1 = dp;
            let s_i_p_minus_1 = sp;
            dp = d[i];
            sp = s[i];
            if (d_i_minus_1 <= d_i_p && d_i_minus_1 <= d_i_p_minus_1) {
                d[i] = dist + d_i_minus_1;
                s[i] = s_i_minus_1;
            } else if (d_i_p <= d_i_minus_1 && d_i_p <= d_i_p_minus_1) {
                d[i] = dist + d_i_p;
                s[i] = s_i_p;
            } else {
                d[i] = dist + d_i_p_minus_1;
                s[i] = s_i_p_minus_1;
            }
        }
        this.bestMatchEndsAtTDistance = d[this.prototypeSize] / this.variance;
        this.bestMatchEndsAtTStart = s[this.prototypeSize];
    }
}

%%GLOBAL%%

function setupRecognizer() {
    let threshold = 1794; // confidenceThreshold = 0.2
%%SETUP%%
}

function recognize(sample: number[]): string {
%%MATCH%%
    let minClass = "NONE";
    let minClassScore = 5000000;
%%MATCH_COMPARISON%%
    return minClass;
}

// Example application code:
setupRecognizer();
basic.forever(() => {
    // Recognize the gesture.
    let className = recognize([input.acceleration(Dimension.X), input.acceleration(Dimension.Y), input.acceleration(Dimension.Z)]);
    // Send the result over serial.
    serial.writeLine(className);
}
`;


export interface ReferenceLabel {
    series: number[][];
    variance: number;
    className: string;
}

export function generateArduinoCodeForDtwModel(sampleRate: number, arduinoSampleRate: number, references: ReferenceLabel[]): string {
    let index = 1;
    const lines = [];
    const setupLines = [];
    const matchLines = [];
    const resetLines = [];
    const matchComparisonLines = [];
    for (const ref of references) {
        const dim = ref.series[0].length;
        const name = 'classPrototype' + index.toString();
        const length = Math.ceil(ref.series.length / sampleRate * arduinoSampleRate);
        const dimensions: Float32Array[] = [];
        for (let i = 0; i < dim; i++) {
            dimensions.push(resampleColumn(ref.series.map((x) => x[i]), 0, 1, 0, 1, length));
        }
        const newSamples = [];
        for (let i = 0; i < length; i++) {
            for (let j = 0; j < dim; j++) {
                newSamples.push(dimensions[j][i]);
            }
        }
        lines.push(`float ${name}_samples[] = { ${newSamples.join(', ')} };`);
        lines.push(`int ${name}_dim = ${dim};`);
        lines.push(`int ${name}_length = ${length};`);
        lines.push(`float ${name}_variance = ${ref.variance / ref.series.length * length};`);
        lines.push(`struct DTWInfo ${name}_DTW;`);

        setupLines.push(`DTWInit(&${name}_DTW, ${dim}, ${name}_samples, ${name}_length, ${name}_variance * threshold);`);
        resetLines.push(`DTWReset(&${name}_DTW);`);

        matchLines.push(`DTWFeed(&${name}_DTW, sample);`);
        matchComparisonLines.push(`if(${name}_DTW.bestMatchEndsAtTDistance < 1 && minClassScore > ${name}_DTW.bestMatchEndsAtTDistance) {`);
        matchComparisonLines.push(`    minClass = '${ref.className}';`);
        matchComparisonLines.push(`    minClassScore = ${name}_DTW.bestMatchEndsAtTDistance;`);
        matchComparisonLines.push('}');

        index += 1;
    }
    matchComparisonLines.push('if(minClassScore < 1) {');
    matchComparisonLines.push('    resetRecognizer();');
    matchComparisonLines.push('}');

    return templateArduino
        .replace('%%GLOBAL%%', lines.join('\n'))
        .replace('%%SETUP%%', setupLines.map((x) => '    ' + x).join('\n'))
        .replace('%%RESET%%', resetLines.map((x) => '    ' + x).join('\n'))
        .replace('%%MATCH%%', matchLines.map((x) => '    ' + x).join('\n'))
        .replace('%%MATCH_COMPARISON%%', matchComparisonLines.map((x) => '    ' + x).join('\n'))
        ;
}


export function generateMicrobitCodeForDtwModel(sampleRate: number, arduinoSampleRate: number, references: ReferenceLabel[]): string {
    let index = 1;
    const lines = [];
    const setupLines = [];
    const matchLines = [];
    const matchComparisonLines = [];
    let maxLength = 0;
    for (const ref of references) {
        const dim = ref.series[0].length;
        const name = 'classPrototype' + index.toString();
        const length = Math.ceil(ref.series.length / sampleRate * arduinoSampleRate);
        maxLength = Math.max(length, maxLength);
        const dimensions: Float32Array[] = [];
        for (let i = 0; i < dim; i++) {
            dimensions.push(resampleColumn(ref.series.map((x) => x[i]), 0, 1, 0, 1, length));
        }
        const newSamples = [];
        for (let i = 0; i < length; i++) {
            for (let j = 0; j < dim; j++) {
                newSamples.push(dimensions[j][i]);
            }
        }
        lines.push(`let ${name}_samples = [ ${newSamples.map(Math.round).join(', ')} ];`);
        lines.push(`let ${name}_dim = ${dim};`);
        lines.push(`let ${name}_length = ${length};`);
        lines.push(`let ${name}_variance = ${ref.variance / ref.series.length * length};`);
        lines.push(`let ${name}_DTW: DTWInfo = null;`);

        setupLines.push(`${name}_DTW = new DTWInfo(${dim}, ${name}_samples, ${name}_length, ${name}_variance * threshold / 1000000);`);

        matchLines.push(`${name}_DTW.feed(sample);`);
        matchComparisonLines.push(
            `if(${name}_DTW.bestMatchEndsAtTDistance < 1000 && minClassScore > ${name}_DTW.bestMatchEndsAtTDistance) {`);
        matchComparisonLines.push(`    minClass = '${ref.className}';`);
        matchComparisonLines.push(`    minClassScore = ${name}_DTW.bestMatchEndsAtTDistance;`);
        matchComparisonLines.push('}');

        index += 1;
    }
    const initialArray: number[] = [];
    for (let i = 0; i < maxLength + 1; i++) { initialArray[i] = 0; }

    return templateMicrobit
        .replace('%%ARRAY_INITIALIZATION%%', '[ ' + initialArray.join(', ') + ' ]')
        .replace('%%ARRAY_INITIALIZATION%%', '[ ' + initialArray.join(', ') + ' ]')
        .replace('%%GLOBAL%%', lines.join('\n'))
        .replace('%%SETUP%%', setupLines.map((x) => '    ' + x).join('\n'))
        .replace('%%MATCH%%', matchLines.map((x) => '    ' + x).join('\n'))
        .replace('%%MATCH_COMPARISON%%', matchComparisonLines.map((x) => '    ' + x).join('\n'))
        ;
}
