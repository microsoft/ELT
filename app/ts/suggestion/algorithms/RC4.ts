// RC4 random generator. See https://en.wikipedia.org/wiki/RC4
// Ported from the Multiclass ModelTracker (now called Squares) project (originally in Javascript, now in Typescript).
export class RC4 {
    private S: number[];
    private i: number;
    private j: number;

    // Initialze the algorithm with a seed.
    constructor(seed: string | number[]) {
        this.S = [];
        this.i = 0;
        this.j = 0;
        for (let i = 0; i < 256; i++) {
            this.S[i] = i;
        }
        if (seed) {
            if (typeof (seed) === 'string') {
                const seed_as_string = seed as string;
                const aseed: number[] = [];
                for (let i = 0; i < seed.length; i++) { aseed[i] = seed_as_string.charCodeAt(i); }
                seed = aseed;
            }
            let j = 0;
            for (let i = 0; i < 256; i++) {
                j += this.S[i] + (seed as number[])[i % seed.length];
                j %= 256;
                const t = this.S[i]; this.S[i] = this.S[j]; this.S[j] = t;
            }
        }
    }

    // Compute the next byte and update internal states.
    public nextByte(): number {
        this.i = (this.i + 1) % 256;
        this.j = (this.j + this.S[this.i]) % 256;
        const t = this.S[this.i]; this.S[this.i] = this.S[this.j]; this.S[this.j] = t;
        return this.S[(this.S[this.i] + this.S[this.j]) % 256];
    }

    // Generate a random number from [ 0, 1 ] uniformally.
    public uniform(): number {
        // Generate 6 bytes.
        let value = 0;
        for (let i = 0; i < 6; i++) {
            value *= 256;
            value += this.nextByte();
        }
        return value / 281474976710656;
    }

    // Generate a random integer from min to max (both inclusive).
    public randint(min: number, max: number): number {
        let value = 0;
        for (let i = 0; i < 6; i++) {
            value *= 256;
            value += this.nextByte();
        }
        return value % (max - min + 1) + min;
    }

    // Choose K numbers from 0 to N - 1 randomly.
    // Using Algorithm R by Jeffrey Vitter.
    public choose(n: number, k: number): number[] {
        const chosen: number[] = [];
        for (let i = 0; i < k; i++) {
            chosen[i] = i;
        }
        for (let i = k; i < n; i++) {
            const j = this.randint(0, i);
            if (j < k) {
                chosen[j] = i;
            }
        }
        return chosen;
    }
}
