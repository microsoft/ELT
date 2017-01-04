import {autocorrelogram} from '../../common/algorithms/Autocorrelation';
import {SensorTimeSeries} from '../../stores/dataStructures/dataset';
import * as d3 from 'd3';
import * as React from 'react';


// Component SensorTimeSeriesRangePlot
// Draw a timeseries in a box of (0, 0, plotWidth, plotHeight). 
// Use rangeStart to set starting time (for scrolling), and pixelsPerSecond to set zooming factor.
export interface AutocorrelogramPlotProps {
    timeSeries: SensorTimeSeries;     // The timeseries object to show, replace it with a NEW object if you need to update its contents.
    pixelsPerSecond: number;          // Scaling factor (assume the dataset's timeunit is seconds).
    plotWidth: number;                // The width of the plot.
    plotHeight: number;               // The height of the plot.
    rangeStart: number;               // The time of the leftmost point in the plot.
}

export interface AutocorrelogramPlotState {
    timeSeries: SensorTimeSeries;
    computedAutocorrelogram: SensorTimeSeries;
    image: string;
}


function renderAutocorrelogramImage(series: SensorTimeSeries): string {
    const renderCanvas = document.createElement('canvas');
    const slices = series.dimensions[0].length;
    const windowSize = series.dimensions.length;
    renderCanvas.width = slices;
    renderCanvas.height = windowSize;
    const context = renderCanvas.getContext('2d');
    const imageData = context.createImageData(slices, windowSize);
    const array = imageData.data;
    let totalSum = 0;
    const ds = series.dimensions;
    for (let i = 0; i < ds.length; i++) {
        const d = ds[i];
        for (let j = 0; j < slices; j++) {
            totalSum += Math.abs(d[j]);
        }
    }
    const totalAverage = totalSum / slices / windowSize;
    for (let i = 0; i < slices; i++) {
        let maxABS = totalAverage * 5;
        for (let j = 0; j < windowSize; j++) {
            const v = ds[j][i];
            maxABS = Math.max(maxABS, Math.abs(v));
        }
        for (let j = 0; j < windowSize; j++) {
            const dindex = ((windowSize - 1 - j) * slices + i) * 4;
            const v = (ds[j][i] / maxABS) + 0.5;
            array[dindex + 0] = 0;
            array[dindex + 1] = 0;
            array[dindex + 2] = 0;
            array[dindex + 3] = v * 255.0;
        }
    }
    context.putImageData(imageData, 0, 0);
    return renderCanvas.toDataURL('image/png');
}


export class AutocorrelogramPlot extends React.Component<AutocorrelogramPlotProps, AutocorrelogramPlotState> {
    constructor(props: AutocorrelogramPlotProps, context: any) {
        super(props, context);

        this.state = {
            computedAutocorrelogram: null,
            timeSeries: null,
            image: null
        };

        this.recomputeAutocorrelogram(props);
    }
    public shouldComponentUpdate(nextProps: AutocorrelogramPlotProps, nextState: AutocorrelogramPlotState): boolean {
        return nextProps.timeSeries !== this.props.timeSeries ||
            nextProps.pixelsPerSecond !== this.props.pixelsPerSecond ||
            nextProps.plotHeight !== this.props.plotHeight ||
            nextProps.rangeStart !== this.props.rangeStart ||
            nextProps.plotWidth !== this.props.plotWidth ||
            nextState.computedAutocorrelogram !== this.state.computedAutocorrelogram ||
            nextState.image !== this.state.image;
    }

    private recomputeAutocorrelogram(props: AutocorrelogramPlotProps): void {
        const timeSeries = props.timeSeries;
        const dimension = new Float32Array(timeSeries.dimensions[0].length);
        for (let i = 0; i < timeSeries.dimensions[0].length; i++) {
            dimension[i] = 0;
            for (let j = 0; j < timeSeries.dimensions.length; j++) {
                if (timeSeries.dimensions[j][i] === timeSeries.dimensions[j][i]) {
                    dimension[i] += timeSeries.dimensions[j][i];
                }
            }
        }

        const autocorrelogram = computeSensorTimeSeriesAutocorrelogram(props.timeSeries);
        setTimeout(
            () => {
                this.setState({
                    computedAutocorrelogram: autocorrelogram,
                    timeSeries: timeSeries,
                    image: renderAutocorrelogramImage(autocorrelogram)
                });
            },
            1);
    }

    public componentWillReceiveProps(newProps: AutocorrelogramPlotProps): void {
        if (this.state.timeSeries !== this.props.timeSeries) {
            this.recomputeAutocorrelogram(newProps);
        }
    }

    public render(): JSX.Element {
        if (!this.state.computedAutocorrelogram) { return (<g></g>); }
        const slicesCount = this.state.computedAutocorrelogram.dimensions[0].length;
        const sliceScale = d3.scaleLinear() // slice index <> slice timestamp
            .domain([0, slicesCount - 1])
            .range([this.state.computedAutocorrelogram.timestampStart, this.state.computedAutocorrelogram.timestampEnd]);
        const timeScale = d3.scaleLinear() // timestamp <> pixel.
            .domain([this.props.rangeStart, this.props.rangeStart + this.props.plotWidth / this.props.pixelsPerSecond])
            .range([0, this.props.plotWidth]);

        const imgX0 = timeScale(sliceScale(-0.5));
        const imgX1 = timeScale(sliceScale(slicesCount - 0.5));

        return (
            <g>
                <image xlinkHref={this.state.image}
                    x={imgX0} y={0}
                    width={imgX1 - imgX0} height={this.props.plotHeight}
                    preserveAspectRatio='none' />
            </g>
        );
    }
}


const autocorrelogramCache = new WeakMap<SensorTimeSeries, SensorTimeSeries>();

export function computeSensorTimeSeriesAutocorrelogram(timeSeries: SensorTimeSeries): SensorTimeSeries {
    if (autocorrelogramCache.has(timeSeries)) { return autocorrelogramCache.get(timeSeries); }

    const sampleRate = (timeSeries.dimensions[0].length - 1) / (timeSeries.timestampEnd - timeSeries.timestampStart);
    const windowSize = Math.ceil(sampleRate * 4);
    const sliceSize = Math.ceil(windowSize / 4);
    const dimension = new Float32Array(timeSeries.dimensions[0].length);
    for (let i = 0; i < timeSeries.dimensions[0].length; i++) {
        dimension[i] = 0;
        for (let j = 0; j < timeSeries.dimensions.length; j++) {
            if (timeSeries.dimensions[j][i] === timeSeries.dimensions[j][i]) {
                dimension[i] += timeSeries.dimensions[j][i];
            }
        }
    }
    const result = autocorrelogram(dimension, windowSize, sliceSize);
    const sliceCount = result.length / windowSize;
    const dimensions: Float32Array[] = [];
    const samplesScale = d3.scaleLinear() // sample index <> sample timestamp
        .domain([0, dimension.length - 1])
        .range([timeSeries.timestampStart, timeSeries.timestampEnd]);
    const sliceScale = d3.scaleLinear() // slice index <> slice timestamp
        .domain([0, sliceCount - 1])
        .range([samplesScale(0 + windowSize / 2), samplesScale(sliceSize * (sliceCount - 1) + windowSize / 2)]);
    for (let i = 0; i < windowSize; i++) {
        const t = dimensions[i] = new Float32Array(sliceCount);
        for (let j = 0; j < sliceCount; j++) {
            t[j] = result[j * windowSize + i];
            if (t[j] !== t[j]) { t[j] = 0; }
        }
    }
    const r = {
        name: timeSeries.name + '.autocorrelogram',
        kind: timeSeries.kind,
        timestampStart: sliceScale.range()[0],
        timestampEnd: sliceScale.range()[1],
        dimensions: dimensions,
        sampleRate: (sliceScale.range()[1] - sliceScale.range()[0]) / (dimension.length - 1),
        scales: [[-1, 1]]
    };
    autocorrelogramCache.set(timeSeries, r);
    return r;
}
