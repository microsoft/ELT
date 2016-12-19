// Implements the PELT Methods for Change Point Detection.

const log2PIplus1 = Math.log(2 * Math.PI) + 1;

function mbicMeanVar(x: number, x2: number, x3: number, n: number): number {
    let sigsq = (x2 - ((x * x) / n)) / n;
    if (sigsq <= 0) {
        sigsq = 0.00000000001;
    }
    return n * (log2PIplus1 + Math.log(sigsq)) + Math.log(n);
}

function makeSumstats(array: number[]): number[][] {
    const n = array.length;

    const cX: number[] = [];
    const cX2: number[] = [];
    const cX3: number[] = [];

    // mean.
    const mu = array.reduce((a, b) => a + b, 0) / n;

    cX[0] = 0;
    cX2[0] = 0;
    cX3[0] = 0;

    for (let i = 0; i < n; i++) {
        cX[i + 1] = cX[i] + array[i];
        cX2[i + 1] = cX2[i] + array[i] * array[i];
        cX3[i + 1] = cX3[i] + (array[i] - mu) * (array[i] - mu);
    }

    return [cX, cX2, cX3];
}

// Adapted from https://github.com/rkillick/changepoint/blob/master/src/PELT_one_func_minseglen.c
// PELT (Pruned Exact Linear Time) Method
//   beta: The penality on the number of change points.
//   minSegmentLength: Minimum distance between change points.
// TODO: Check license!! Are we allowed to redistribute the code from the changepoint R package?
export function pelt(data: (number[] | Float32Array)[], beta: number, minSegmentLength: number = 10): number[] {
    const sumStatistics = data.map(makeSumstats);
    const n = data[0].length;
    const rangeCost = (j: number, i: number) => {
        let r = 0;
        sumStatistics.forEach((ss) => {
            r += mbicMeanVar(ss[0][j] - ss[0][i], ss[1][j] - ss[1][i], ss[2][j] - ss[2][i], j - i);
        });
        return r;
    };

    const lastChangeLike: number[] = [];
    const lastChangeCpts: number[] = [];

    const checkList: number[] = [];
    let nCheckList = 0;

    const tmpLike: number[] = [];
    const tmpT: number[] = [];

    [tmpLike, tmpT, checkList, lastChangeLike, lastChangeCpts].forEach((x) => {
        for (let i = 0; i < x.length; i++) { x[i] = 0; }
    });

    lastChangeLike[0] = -beta;
    lastChangeCpts[0] = 0;

    for (let j = minSegmentLength; j < 2 * minSegmentLength; j++) {
        lastChangeLike[j] = rangeCost(j, 0);
    }

    for (let j = minSegmentLength; j < 2 * minSegmentLength; j++) {
        lastChangeCpts[j] = 0;
    }

    nCheckList = 2;
    checkList[0] = 0;
    checkList[1] = minSegmentLength;

    const k = -4 * Math.log(n);

    for (let tStar = 2 * minSegmentLength; tStar <= n; tStar++) {
        if ((lastChangeLike[tStar]) === 0) {
            let minOut = 0; let whichOut = -1;
            for (let i = 0; i < nCheckList; i++) {
                tmpLike[i] = lastChangeLike[checkList[i]] + rangeCost(tStar, checkList[i]) + beta;
                if (whichOut === -1 || tmpLike[i] < minOut) {
                    minOut = tmpLike[i];
                    whichOut = i;
                }
            }
            // Updates minout and whichout with min and which element.
            lastChangeLike[tStar] = minOut;
            lastChangeCpts[tStar] = checkList[whichOut];
            // Update checklist for next iteration, first element is next tau.
            let nCheckTmp = 0;
            for (let i = 0; i < nCheckList; i++) {
                if (tmpLike[i] + k <= (lastChangeLike[tStar])) {
                    checkList[nCheckTmp] = checkList[i];
                    nCheckTmp += 1;
                }
            }
            nCheckList = nCheckTmp;
        }
        checkList[nCheckList] = tStar - minSegmentLength - 1; // at least 1 obs per seg
        nCheckList += 1;
    }


    // Put final set of changepoints together
    let last = n;
    const cptsOut: number[] = [];
    while (last !== 0) {
        if (last !== n) {
            cptsOut.push(last - 1);
        }
        last = lastChangeCpts[last];
    }
    cptsOut.reverse();
    return cptsOut;
}
