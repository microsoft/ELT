// TrackView: display a single track in the app.

import { Track } from '../../stores/dataStructures/alignment';
import { SensorTimeSeries, TimeSeries, TimeSeriesKind, VideoTimeSeries } from '../../stores/dataStructures/dataset';
import { SignalsViewMode } from '../../stores/dataStructures/labeling';
import { PanZoomParameters } from '../../stores/dataStructures/PanZoomParameters';
import * as stores from '../../stores/stores';
import { AutocorrelogramPlot } from '../common/AutocorrelogramPlot';
import { SensorRangePlot } from '../common/SensorPlot';
import { VideoFrame, VideoRangePlot } from '../common/VideoPlot';
import * as d3 from 'd3';
import { observer } from 'mobx-react';
import * as React from 'react';



export interface TrackViewProps {
    track: Track;
    viewWidth: number;
    viewHeight: number;
    zoomTransform: PanZoomParameters;
    signalsViewMode?: SignalsViewMode;
    colorScale?: any;
    useMipmap?: boolean;
    videoDetail?: boolean;

    onMouseDown?: (event: React.MouseEvent<Element>, track: Track, time: number, pps: number) => any;
}


@observer
export class TrackView extends React.Component<TrackViewProps, {}> {

    public render(): JSX.Element {
        const track = this.props.track;

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

                        const scaleTimeToPixel = d3.scaleLinear()
                            .domain([this.props.zoomTransform.rangeStart, this.props.zoomTransform.getTimeFromX(this.props.viewWidth)])
                            .range([0, this.props.viewWidth]);

                        const startX = Math.max(0, Math.min(this.props.viewWidth, scaleTimeToPixel(track.referenceStart)));
                        const endX = Math.max(0, Math.min(this.props.viewWidth, scaleTimeToPixel(track.referenceEnd)));

                        const seriesHeight = this.props.viewHeight / track.timeSeries.length;
                        const seriesY = seriesHeight * t;

                        const scaleSignalToReference = d3.scaleLinear()
                            .domain([timeSeries.timestampStart, timeSeries.timestampEnd])
                            .range([track.referenceStart, track.referenceEnd]);

                        const startTime = scaleSignalToReference.invert(scaleTimeToPixel.invert(startX));
                        const endTime = scaleSignalToReference.invert(scaleTimeToPixel.invert(endX));

                        return (
                            <g transform={`translate(${startX}, ${seriesY})`} key={`ts-${track.id}-${t}`}>
                                <TimeSeriesView
                                    track={track}
                                    timeSeries={timeSeries}
                                    startX={startX} endX={endX}
                                    height={seriesHeight}
                                    startTime={startTime} endTime={endTime}
                                    colorScale={this.props.colorScale}
                                    useMipmap={this.props.useMipmap}
                                    videoDetail={this.props.videoDetail}
                                    onMouseDown={this.props.onMouseDown}
                                    signalsViewMode={this.props.signalsViewMode}
                                />
                            </g>
                        );
                    })
                }
            </g>
        );
    }

}












export interface TimeSeriesViewProps {
    track: Track;
    timeSeries: TimeSeries;
    startX: number;
    endX: number;
    height: number;
    startTime: number;
    endTime: number;
    colorScale?: any;
    useMipmap?: boolean;
    videoDetail?: boolean;
    signalsViewMode?: SignalsViewMode;

    onMouseDown?: (event: React.MouseEvent<Element>, track: Track, time: number, pps: number) => any;
}



@observer
export class TimeSeriesView extends React.Component<TimeSeriesViewProps, {}> {

    constructor(props: TrackViewProps, context: any) {
        super(props, context);
        this.onMouseEnter = this.onMouseEnter.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onWheel = this.onWheel.bind(this);
    }

    public get width(): number { return this.props.endX - this.props.startX; }
    public get duration(): number { return this.props.endTime - this.props.startTime; }
    public get pixelsPerSecond(): number { return this.width / this.duration; }

    private timeToPixels(t: number): number {
        return this.props.startX + (t - this.props.startTime) * this.pixelsPerSecond;
    }
    private pixelsToTime(x: number): number {
        return this.props.startTime + (x - this.props.startX) / this.pixelsPerSecond;
    }

    private getTimeFromMouseX(event: React.MouseEvent<Element> | React.WheelEvent<Element>): number {
        const left = (event.target as SVGElement).getBoundingClientRect().left;
        const x = event.clientX - left;
        return this.pixelsToTime(x);
    }

    // In these events, t and pps are in the timeSeries' local time, not the reference time.
    private onMouseMove(event: React.MouseEvent<Element>): void {
        const time = this.getTimeFromMouseX(event);
        const track = this.props.track;
        if (track.isAlignedToReferenceTrack) {
            const scale = d3.scaleLinear()
                .domain([track.referenceStart, track.referenceEnd])
                .range([track.timeSeries[0].timestampStart, track.timeSeries[0].timestampEnd]);
            stores.projectUiStore.setReferenceTrackTimeCursor(scale.invert(time));
        } else {
            stores.projectUiStore.setTimeCursor(track, time);
        }
    }

    private onMouseLeave(): void {
        stores.projectUiStore.setTimeCursor(this.props.track, null);
    }

    private onMouseEnter(event: React.MouseEvent<Element>): void {
        const time = this.getTimeFromMouseX(event);
        stores.projectUiStore.setTimeCursor(this.props.track, time);
    }

    private onMouseDown(event: React.MouseEvent<Element>): void {
        const time = this.getTimeFromMouseX(event);
        if (this.props.onMouseDown) { this.props.onMouseDown(event, this.props.track, time, this.pixelsPerSecond); }
    }

    private onWheel(event: React.WheelEvent<Element>): void {
        const deltaY = event.deltaY;
        const track = this.props.track;
        if (stores.projectStore.isReferenceTrack(track) || track.isAlignedToReferenceTrack) {
            stores.projectUiStore.zoomReferenceTrack(deltaY / 1000, 'cursor');
        } else {
            const scale = d3.scaleLinear()
                .domain([track.referenceStart, track.referenceEnd])
                .range([this.props.timeSeries.timestampStart, this.props.timeSeries.timestampEnd]);
            const timeCursor = stores.projectUiStore.getTimeCursor(track);
            if (timeCursor === null) { return; }
            const { rangeStart: oldStart, pixelsPerSecond: oldPPS } =
                stores.projectUiStore.getTrackPanZoom(track);
            const k = Math.exp(-deltaY / 1000);
            const newPPS = oldPPS * k;
            const newStart = oldStart / k + scale.invert(timeCursor) * (1 - 1 / k);
            stores.projectUiStore.setTrackPanZoom(track, new PanZoomParameters(newStart, newPPS));
        }
    }

    private renderVideoDetail(): JSX.Element {
        const video = this.props.timeSeries as VideoTimeSeries;
        const scaledVideoWidth = this.props.height * video.width / video.height;
        const timeCursor = this.timeCursor;
        const timeCursorX = timeCursor != null ? this.timeToPixels(timeCursor) : null;
        return (
            <VideoFrame
                x={Math.max(0, Math.min(
                    this.width - scaledVideoWidth,
                    timeCursorX - scaledVideoWidth * 0.5))}
                y={0}
                width={scaledVideoWidth} height={this.props.height}
                timeCursor={timeCursor}
                timeSeries={this.props.timeSeries as VideoTimeSeries}
            />
        );
    }

    private renderVideoOverview(): JSX.Element {
        return (
            <g opacity={1}>
                <VideoRangePlot
                    timeSeries={this.props.timeSeries as VideoTimeSeries}
                    rangeStart={this.props.startTime} pixelsPerSecond={this.pixelsPerSecond}
                    plotWidth={this.width} plotHeight={this.props.height}
                />
            </g>
        );
    }

    private renderAutocorrelogram(): JSX.Element {
        return (
            <AutocorrelogramPlot
                timeSeries={this.props.timeSeries as SensorTimeSeries}
                rangeStart={this.props.startTime} pixelsPerSecond={this.pixelsPerSecond}
                plotWidth={this.width} plotHeight={this.props.height}
            />
        );
    }

    private renderPlot(): JSX.Element {
        return (
            <SensorRangePlot
                timeSeries={this.props.timeSeries as SensorTimeSeries}
                rangeStart={this.props.startTime} pixelsPerSecond={this.pixelsPerSecond}
                plotWidth={this.width} plotHeight={this.props.height}
                useMipmap={this.props.useMipmap}
                colorScale={this.props.colorScale}
            />
        );
    }

    private renderTimeSeries(): JSX.Element {
        switch (this.props.timeSeries.kind) {
            case TimeSeriesKind.VIDEO:
                return this.props.videoDetail ?
                    this.renderVideoDetail() :
                    this.renderVideoOverview();
            default:
                switch (this.props.signalsViewMode) {
                    case SignalsViewMode.AUTOCORRELOGRAM:
                        return this.renderAutocorrelogram();
                    case SignalsViewMode.COMBINED:
                        return (<g>
                            {this.renderAutocorrelogram()}
                            {this.renderPlot()}
                        </g>);
                    default:
                        return this.renderPlot();
                }
        }
    }

    private get timeCursor(): number {
        let timeCursor: number = stores.projectUiStore.getTimeCursor(this.props.track);
        if (timeCursor < this.props.timeSeries.timestampStart || timeCursor > this.props.timeSeries.timestampEnd) {
            timeCursor = null;
        }
        return timeCursor;
    }

    private renderTimeCursor(): JSX.Element {
        if (this.props.videoDetail) { return null; }
        const timeCursor = this.timeCursor;
        const timeCursorX = timeCursor != null ? this.timeToPixels(timeCursor) : null;
        return (
            <g>
                <rect style={{ stroke: 'none', cursor: 'crosshair', fill: 'none', pointerEvents: 'all' }}
                    x={0} y={0}
                    width={this.width} height={this.props.height}
                    onMouseDown={this.onMouseDown}
                    onMouseMove={this.onMouseMove}
                    onMouseEnter={this.onMouseEnter}
                    onMouseLeave={this.onMouseLeave}
                    onWheel={this.onWheel}
                />
                {
                    timeCursor != null ? (
                        <line
                            x1={timeCursorX} y1={0}
                            x2={timeCursorX} y2={this.props.height}
                            style={{ stroke: 'black', pointerEvents: 'none' }}
                        />
                    ) : (null)
                }
            </g>
        );
    }

    public render(): JSX.Element {
        return (
            <g>
                {this.renderTimeSeries()}
                {this.renderTimeCursor()}
            </g>
        );
    }
}
