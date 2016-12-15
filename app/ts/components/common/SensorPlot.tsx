import {SensorTimeSeries} from '../../common/dataset';
import {getUniqueIDForObject, isSameArray} from '../../common/ui/utils';
import {MipmapCache} from './Mipmap';
import * as d3 from 'd3';
import * as React from 'react';


// Global mipmap cache for sensor plots.
const mipmapCache = new MipmapCache();

// Component SensorTimeSeriesPlot
// This is a long timeseries without any boundary. 
// To show a timeseries with boundary (i.e., in a rectangle and scrollable), use SensorTimeSeriesRangePlot
export interface SensorTimeSeriesPlotProps {
    timeSeries: SensorTimeSeries;     // The timeseries object to show, replace it with a NEW object if you need to update its contents.
    dimensionVisibility?: boolean[];  // boolean array to show/hide individual dimensions.
    colorScale?: any;                 // Colors to use, if null, use d3.category10 or 20.
    pixelsPerSecond: number;          // Scaling factor (assume the dataset's timeunit is seconds).
    plotHeight: number;               // The height of the plot.
    yDomain?: number[];               // The y domain: [ min, max ], similar to D3's scale.domain([min, max]).
    iSlice?: number[];                // The slice to render: [ start, end ], in sample indices.
    alternateDimensions?: (number[] | Float32Array)[]; // If set, use this dimensions as data, instead of the data from timeSeries.
}

export class SensorTimeSeriesPlot extends React.Component<SensorTimeSeriesPlotProps, {}> {

    public shouldComponentUpdate(nextProps: SensorTimeSeriesPlotProps): boolean {
        // We consider the timeSeries object and colorScale constant, so any change INSIDE these objects will not trigger an update.
        // To change the timeSeries, replace it with another object, don't update it directly.
        return nextProps.timeSeries !== this.props.timeSeries ||
            nextProps.colorScale !== this.props.colorScale ||
            nextProps.pixelsPerSecond !== this.props.pixelsPerSecond ||
            nextProps.plotHeight !== this.props.plotHeight ||
            nextProps.alternateDimensions !== this.props.alternateDimensions ||
            !isSameArray(nextProps.yDomain, this.props.yDomain) ||
            !isSameArray(nextProps.dimensionVisibility, this.props.dimensionVisibility) ||
            !isSameArray(nextProps.iSlice, this.props.iSlice)
            ;
    }

    public render(): JSX.Element {
        // Determine y domain.
        let y0: number; let y1: number;
        if (this.props.yDomain) {
            y0 = this.props.yDomain[0];
            y1 = this.props.yDomain[1];
        } else {
            y0 = d3.min(this.props.timeSeries.scales, (x) => x[0]);
            y1 = d3.max(this.props.timeSeries.scales, (x) => x[1]);
        }

        const numSeries = this.props.timeSeries.dimensions.length;
        const dimensions = this.props.alternateDimensions ? this.props.alternateDimensions : this.props.timeSeries.dimensions;
        const length = dimensions[0].length;

        // Compute these paramters before the loop to improve efficiency.
        const xStart = 0;
        const xStep = (this.props.timeSeries.timestampEnd - this.props.timeSeries.timestampStart) /
            (length - 1) * this.props.pixelsPerSecond;
        const yOffset = -y1 / (y0 - y1) * this.props.plotHeight;
        const yScale = 1 / (y0 - y1) * this.props.plotHeight;

        // Determine color scale.
        let colors = null;
        if (this.props.colorScale) {
            colors = this.props.colorScale;
        } else {
            colors = numSeries <= 10 ? d3.scale.category10() : d3.scale.category20();
        }

        const paths = dimensions.map((dimSeries: number[], dimIndex: number) => {
            if (this.props.dimensionVisibility !== undefined && this.props.dimensionVisibility !== null) {
                if (!this.props.dimensionVisibility[dimIndex]) { return null; }
            }
            const positions: string[] = [];

            let iStart = 0;
            let iEnd = length;
            if (this.props.iSlice) {
                iStart = this.props.iSlice[0];
                iEnd = this.props.iSlice[1];
            }

            for (let i = iStart; i < iEnd; i++) {
                const x = xStart + i * xStep;
                const y = yOffset + dimSeries[i] * yScale;
                if (x === x && y === y) {
                    positions.push(x + ',' + y);
                }
            }
            const d: string = 'M' + positions.join('L');
            const style = {
                fill: 'none',
                stroke: colors(dimIndex)
            };
            return (
                <path
                    d={d} style={style} key={dimIndex}
                    />
            );
        });

        return (
            <g className='sensor-timeseries-plot'>
                {paths}
            </g>
        );
    }
}

// Component SensorTimeSeriesRangePlot
// Draw a timeseries in a box of (0, 0, plotWidth, plotHeight). 
// Use rangeStart to set starting time (for scrolling), and pixelsPerSecond to set zooming factor.
export interface SensorTimeSeriesRangePlotProps {
    timeSeries: SensorTimeSeries;     // The timeseries object to show, replace it with a NEW object if you need to update its contents.
    dimensionVisibility?: boolean[];  // boolean array to show/hide individual dimensions.
    colorScale?: any;                 // Colors to use, if null, use d3.category10 or 20.
    pixelsPerSecond: number;          // Scaling factor (assume the dataset's timeunit is seconds).
    plotWidth: number;                // The width of the plot.
    plotHeight: number;               // The height of the plot.
    yDomain?: number[];               // The y domain: [ min, max ], similar to D3's scale.domain([min, max]).
    rangeStart: number;               // The time of the leftmost point in the plot.

    onDrag?: (newRangeStart: number) => any;
    // Optional drag event handler.

    useMipmap?: boolean;              // Enable mipmap.
}

export class SensorTimeSeriesRangePlot extends React.Component<SensorTimeSeriesRangePlotProps, {}> {

    public shouldComponentUpdate(nextProps: SensorTimeSeriesRangePlotProps): boolean {
        return nextProps.timeSeries !== this.props.timeSeries ||
            nextProps.colorScale !== this.props.colorScale ||
            nextProps.pixelsPerSecond !== this.props.pixelsPerSecond ||
            nextProps.plotHeight !== this.props.plotHeight ||
            !isSameArray(nextProps.yDomain, this.props.yDomain) ||
            !isSameArray(nextProps.dimensionVisibility, this.props.dimensionVisibility) ||
            nextProps.rangeStart !== this.props.rangeStart ||
            nextProps.plotWidth !== this.props.plotWidth ||
            nextProps.onDrag !== this.props.onDrag
            ;
    }

    private onMouseDown(event: any): void {
        event.stopPropagation();
        event.preventDefault();

        const x0 = event.screenX;
        const oldRangeStart = this.props.rangeStart;

        const onMousemove = () => {
            const x1 = (d3.event as MouseEvent).screenX;
            if (this.props.onDrag) {
                const newRangeStart = (x0 - x1) / this.props.pixelsPerSecond + oldRangeStart;
                this.props.onDrag(newRangeStart);
            }
        };

        const onMouseup = () => {
            d3.select(window).on('mousemove.drag', null);
            d3.select(window).on('mouseup.drag', null);
        };

        d3.select(window).on('mousemove.drag', onMousemove);
        d3.select(window).on('mouseup.drag', onMouseup);
    }

    public render(): JSX.Element {
        const left = (this.props.timeSeries.timestampStart - this.props.rangeStart) * this.props.pixelsPerSecond;
        const clippathID = getUniqueIDForObject(this) + 'clip';
        const timeseries = this.props.timeSeries;
        let rectStyle;
        if (this.props.onDrag) {
            rectStyle = {
                fill: 'none',
                stroke: 'none',
                cursor: 'ew-resize',
                pointerEvents: 'all'
            };
        } else {
            rectStyle = {
                fill: 'none',
                stroke: 'none',
                visibility: 'invisible',
                pointerEvents: 'none'
            };
        }

        let mipmap: Float32Array[];
        if (this.props.useMipmap) {
            // Determine the mipmap: We need at least 2 points per pixel.
            mipmap = mipmapCache.getMipmapForLength(
                timeseries.dimensions,
                this.props.pixelsPerSecond * (timeseries.timestampEnd - timeseries.timestampStart) * 2);
        } else {
            // Mipmap disables, use the original data.
            mipmap = timeseries.dimensions.map((x) => new Float32Array(x));
        }

        // Divide the whole timeseries into chunks.
        const slices = [];
        const seriesLength = mipmap[0].length;
        const sliceSize = 2048;
        let iMin = (this.props.rangeStart - timeseries.timestampStart) /
            (timeseries.timestampEnd - timeseries.timestampStart) * (seriesLength - 1);
        let iMax = (this.props.rangeStart + this.props.plotWidth / this.props.pixelsPerSecond - timeseries.timestampStart) /
            (timeseries.timestampEnd - timeseries.timestampStart) * (seriesLength - 1);
        const iDistance = iMax - iMin;
        iMin -= iDistance / 2;
        iMax += iDistance / 2;
        for (let i = 0; i < seriesLength; i += sliceSize) {
            const slice = [i, Math.min(i + sliceSize + 1, seriesLength)];
            // If the slice intersects with iMin, iMax, render it.
            if (!(slice[1] < iMin || slice[0] > iMax)) {
                slices.push(slice);
            }
        }
        const slicePlots = slices.map((slice) => {
            return (
                <SensorTimeSeriesPlot
                    key={`slice-${slice[0]}`}
                    timeSeries={timeseries}
                    colorScale={this.props.colorScale}
                    pixelsPerSecond={this.props.pixelsPerSecond}
                    plotHeight={this.props.plotHeight}
                    yDomain={this.props.yDomain}
                    iSlice={slice}
                    alternateDimensions={mipmap}
                    dimensionVisibility={this.props.dimensionVisibility}
                    />
            );
        });

        return (
            <g>
                <defs>
                    <clipPath id={clippathID}>
                        <rect
                            x={0} y={-2} width={this.props.plotWidth} height={this.props.plotHeight + 4}
                            />
                    </clipPath>
                </defs>
                <g clipPath={`url(#${clippathID})`}>
                    <g transform={`translate(${left}, 0)`}>
                        {slicePlots}
                    </g>
                </g>
                <rect
                    style={rectStyle}
                    x={0} y={0} width={this.props.plotWidth} height={this.props.plotHeight}
                    onMouseDown={event => { this.onMouseDown(event); } }
                    />
            </g>
        );
    }
}
