// TrackView: display a single track in the app.

import { Track } from '../../stores/dataStructures/alignment';
import { SensorTimeSeries, TimeSeriesKind, VideoTimeSeries } from '../../stores/dataStructures/dataset';
import { SignalsViewMode } from '../../stores/dataStructures/labeling';
import { PanZoomParameters } from '../../stores/ProjectUiStore';
import { AutocorrelogramPlot } from '../common/AutocorrelogramPlot';
import { SensorRangePlot } from '../common/SensorPlot';
import { VideoFrame, VideoRangePlot } from '../common/VideoPlot';
import * as d3 from 'd3';
import * as React from 'react';



export interface TrackViewProps {
    track: Track;
    viewWidth: number;
    viewHeight: number;
    zoomTransform: PanZoomParameters;
    signalsViewMode?: SignalsViewMode;
    colorScale?: any;
    useMipmap?: boolean;
    timeCursor?: number;

    onWheel?: (event: React.WheelEvent<Element>, track: Track, t: number, pps: number, deltaY: number) => any;
    onMouseMove?: (event: React.MouseEvent<Element>, track: Track, t: number, pps: number) => any;
    onMouseDown?: (event: React.MouseEvent<Element>, track: Track, t: number, pps: number) => any;
    onMouseEnter?: (event: React.MouseEvent<Element>, track: Track, t: number, pps: number) => any;
    onMouseLeave?: (event: React.MouseEvent<Element>, track: Track, t: number, pps: number) => any;
}



export function truncatePPS(pps: number): number {
    if (pps <= 0) { return pps; }
    const numDigits = Math.ceil(Math.log(pps) / Math.log(2));
    const scaler = Math.pow(2, (32 - numDigits));
    return Math.round(pps * scaler) / scaler;
}



export class TrackView extends React.Component<TrackViewProps, {}> {
    public refs: {
        [name: string]: Element,
        interactionRect: Element
    };

    private getRelativePosition(event: React.MouseEvent<Element> | React.WheelEvent<Element>): number[] {
        const x: number = event.clientX - this.refs.interactionRect.getBoundingClientRect().left;
        const y: number = event.clientY - this.refs.interactionRect.getBoundingClientRect().top;
        return [x, y];
    }

    private onMouseDown(event: React.MouseEvent<Element>, track: Track, t: number, pps: number): void {
        if (this.props.onMouseDown) { this.props.onMouseDown(event, track, t, pps); }
    }
    private onMouseMove(event: React.MouseEvent<Element>, track: Track, t: number, pps: number): void {
        if (this.props.onMouseMove) { this.props.onMouseMove(event, track, t, pps); }
    }
    private onMouseEnter(event: React.MouseEvent<Element>, track: Track, t: number, pps: number): void {
        if (this.props.onMouseEnter) { this.props.onMouseEnter(event, track, t, pps); }
    }
    private onMouseLeave(event: React.MouseEvent<Element>, track: Track, t: number, pps: number): void {
        if (this.props.onMouseLeave) { this.props.onMouseLeave(event, track, t, pps); }
    }
    private onWheel(
        event: React.WheelEvent<Element>, track: Track, t: number, pps: number,
        deltaY: number): void {
        if (this.props.onWheel) { this.props.onWheel(event, track, t, pps, deltaY); }
    }


    public render(): JSX.Element {
        const track = this.props.track;
        // Get zooming factors.
        const zooming = this.props.zoomTransform;
        // scale: Reference -> Pixel.
        const sReferenceToPixel = d3.scaleLinear()
            .domain([zooming.rangeStart, zooming.getTimeFromX(this.props.viewWidth)])
            .range([0, this.props.viewWidth]);

        return (
            <g className='track-view'>
                <rect style={{ stroke: 'none', fill: 'none', pointerEvents: 'none' }}
                    ref='interactionRect'
                    x={0} y={0}
                    width={this.props.viewWidth}
                    height={this.props.viewHeight}
                />
                {
                    track.timeSeries.map((timeSeries, t) => {
                        // scale: Signal -> Reference.
                        const sSignalToReference = d3.scaleLinear()
                            .domain([timeSeries.timestampStart, timeSeries.timestampEnd])
                            .range([track.referenceStart, track.referenceEnd]);

                        // Determine the x range.
                        let xStart = sReferenceToPixel(track.referenceStart);
                        let xEnd = sReferenceToPixel(track.referenceEnd);

                        // Clamp the x range to the boundary of the view.
                        xStart = Math.max(0, Math.min(this.props.viewWidth, xStart));
                        xEnd = Math.max(0, Math.min(this.props.viewWidth, xEnd));

                        if (xEnd === xStart) { return null; }

                        // Determine the range start and end in reference time.
                        const rStart = sReferenceToPixel.invert(xStart);
                        const rEnd = sReferenceToPixel.invert(xEnd);

                        // Determine the range start and end in signal time.
                        const tStart = sSignalToReference.invert(rStart);
                        const tEnd = sSignalToReference.invert(rEnd);
                        const pps = truncatePPS((xEnd - xStart) / (tEnd - tStart));

                        // Get time from mouse event.
                        const getTime = (event: React.MouseEvent<Element> | React.WheelEvent<Element>) => {
                            const x = this.getRelativePosition(event)[0];
                            return tStart + (x - xStart) / pps;
                        };

                        // Get time cursor x position.
                        let timeCursor: number = this.props.timeCursor;
                        // Don't display timeCursor if it's outside.
                        if (timeCursor < timeSeries.timestampStart || timeCursor > timeSeries.timestampEnd) {
                            timeCursor = null;
                        }
                        const timeCursorX = timeCursor != null ? sReferenceToPixel(sSignalToReference(timeCursor)) : null;

                        const chunkHeight = this.props.viewHeight / track.timeSeries.length;
                        const ySeries = chunkHeight * t;

                        const interactionRect = (
                            <g>
                                <rect style={{ stroke: 'none', cursor: 'crosshair', fill: 'none', pointerEvents: 'all' }}
                                    x={0}
                                    y={0}
                                    width={xEnd - xStart}
                                    height={chunkHeight}
                                    onMouseDown={event => { this.onMouseDown(event, track, getTime(event), pps); }}
                                    onMouseMove={event => { this.onMouseMove(event, track, getTime(event), pps); }}
                                    onMouseEnter={event => { this.onMouseEnter(event, track, getTime(event), pps); }}
                                    onMouseLeave={event => { this.onMouseLeave(event, track, getTime(event), pps); }}
                                    onWheel={event => { this.onWheel(event, track, getTime(event), pps, event.deltaY); }}
                                />
                                {
                                    timeCursor != null ? (
                                        <line
                                            x1={timeCursorX - xStart}
                                            x2={timeCursorX - xStart}
                                            y1={0}
                                            y2={chunkHeight}
                                            style={{ stroke: 'black', pointerEvents: 'none' }}
                                        />
                                    ) : (null)
                                }
                            </g>
                        );

                        if (timeSeries.kind === TimeSeriesKind.VIDEO) {
                            const video = timeSeries as VideoTimeSeries;
                            const scaledVideoWidth = this.props.viewHeight * video.width / video.height;
                            if (timeCursor != null) {
                                return (
                                    <g transform={`translate(${xStart}, 0)`} key={`ts-${track.id}-${t}`}>
                                        <VideoFrame
                                            x={Math.max(
                                                0,
                                                Math.min(
                                                    this.props.viewWidth - scaledVideoWidth,
                                                    timeCursorX - scaledVideoWidth * 0.5))
                                                - xStart}
                                            y={0}
                                            width={scaledVideoWidth}
                                            height={this.props.viewHeight}
                                            timeCursor={timeCursor}
                                            timeSeries={video}
                                        />
                                    </g>
                                );
                            } else {
                                return (
                                    <g transform={`translate(${xStart}, 0)`} key={`ts-${track.id}-${t}`}>
                                        <g opacity={1}>
                                            <VideoRangePlot
                                                timeSeries={video}
                                                rangeStart={tStart}
                                                pixelsPerSecond={pps}
                                                plotWidth={xEnd - xStart}
                                                plotHeight={this.props.viewHeight}
                                            />
                                        </g>
                                        {interactionRect}
                                    </g>
                                );
                            }
                        } else {
                            switch (this.props.signalsViewMode) {
                                case SignalsViewMode.AUTOCORRELOGRAM:
                                    return (
                                        <g transform={`translate(${xStart}, ${ySeries})`} key={`ts-${track.id}-${t}`}>

                                            <AutocorrelogramPlot
                                                timeSeries={timeSeries as SensorTimeSeries}
                                                rangeStart={tStart}
                                                pixelsPerSecond={pps}
                                                plotWidth={xEnd - xStart}
                                                plotHeight={chunkHeight}
                                            />
                                            {interactionRect}
                                        </g>
                                    );
                                case SignalsViewMode.COMBINED:
                                    return (
                                        <g transform={`translate(${xStart}, ${ySeries})`} key={`ts-${track.id}-${t}`}>
                                            <AutocorrelogramPlot
                                                timeSeries={timeSeries as SensorTimeSeries}
                                                rangeStart={tStart}
                                                pixelsPerSecond={pps}
                                                plotWidth={xEnd - xStart}
                                                plotHeight={chunkHeight}
                                            />
                                            <SensorRangePlot
                                                timeSeries={timeSeries as SensorTimeSeries}
                                                rangeStart={tStart}
                                                pixelsPerSecond={pps}
                                                plotWidth={xEnd - xStart}
                                                plotHeight={chunkHeight}
                                                useMipmap={this.props.useMipmap}
                                                colorScale={this.props.colorScale}
                                            />
                                            {interactionRect}
                                        </g>
                                    );
                                case SignalsViewMode.TIMESERIES:
                                default:
                                    return (
                                        <g transform={`translate(${xStart}, ${ySeries})`} key={`ts-${track.id}-${t}`}>
                                            <SensorRangePlot
                                                timeSeries={timeSeries as SensorTimeSeries}
                                                rangeStart={tStart}
                                                pixelsPerSecond={pps}
                                                plotWidth={xEnd - xStart}
                                                plotHeight={chunkHeight}
                                                useMipmap={this.props.useMipmap}
                                                colorScale={this.props.colorScale}
                                            />
                                            {interactionRect}
                                        </g>
                                    );
                            }
                        }
                    })
                }
            </g>
        );
    }
}
