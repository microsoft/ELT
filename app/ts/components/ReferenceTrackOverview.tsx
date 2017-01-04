// The 'Overview' view that is shared by both alignment and labeling.

import * as Actions from '../actions/Actions';
import { Track } from '../stores/dataStructures/alignment';
import { makePathDFromPoints, startDragging } from '../stores/utils';
import { LayoutParameters } from '../stores/dataStructures/LayoutParameters';
import { KeyCode } from '../stores/dataStructures/types';
import * as stores from '../stores/stores';
import { EventListenerComponent } from './common/EventListenerComponent';
import { TimeAxis } from './common/TimeAxis';
import { TrackView } from './common/TrackView';
import { LabelKind } from './labeling/LabelPlot';
import { LabelsRangePlot } from './labeling/LabelsRangePlot';
import * as d3 from 'd3';
import * as React from 'react';


export interface ReferenceTrackOverviewProps {
    mode: string;
    viewWidth: number;
    viewHeight: number;
    downReach: number;
}


interface ReferenceTrackOverviewState {
    referenceTrack: Track;
    // Time range.
    referenceTimestampStart: number;
    referenceTimestampEnd: number;
    referenceViewStart: number;
    referenceViewEnd: number;

    referenceTimeCursor: number;
}


export class ReferenceTrackOverview extends EventListenerComponent<ReferenceTrackOverviewProps, ReferenceTrackOverviewState> {
    public refs: {
        [key: string]: Element,
        interactionRect: Element
    };

    constructor(props: ReferenceTrackOverviewProps, context: any) {
        super(props, context, [
            stores.alignmentLabelingUiStore.referenceViewTimeCursorChanged,
            stores.alignmentLabelingUiStore.referenceViewChanged,
            stores.alignmentStore.alignmentChanged
        ]);

        this.state = this.computeState();

        this.updateState = this.updateState.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
    }

    private computeState(): ReferenceTrackOverviewState {
        if (!stores.alignmentLabelingStore.referenceTrack) {
            return {
                referenceTrack: null,
                referenceTimestampStart: 0,
                referenceTimestampEnd: 1,
                referenceViewStart: stores.alignmentLabelingUiStore.referenceViewStart,
                referenceViewEnd:
                stores.alignmentLabelingUiStore.referenceViewStart +
                this.props.viewWidth / stores.alignmentLabelingUiStore.referenceViewPPS,
                referenceTimeCursor: stores.alignmentLabelingUiStore.referenceViewTimeCursor
            };
        } else {
            return {
                referenceTrack: stores.alignmentLabelingStore.referenceTrack,
                referenceTimestampStart: stores.alignmentLabelingUiStore.referenceTimestampStart,
                referenceTimestampEnd: stores.alignmentLabelingUiStore.referenceTimestampEnd,
                referenceViewStart: stores.alignmentLabelingUiStore.referenceViewStart,
                referenceViewEnd:
                stores.alignmentLabelingUiStore.referenceViewStart +
                this.props.viewWidth / stores.alignmentLabelingUiStore.referenceViewPPS,
                referenceTimeCursor: stores.alignmentLabelingUiStore.referenceViewTimeCursor
            };
        }
    }

    protected updateState(): void {
        this.setState(this.computeState());
    }

    private onKeyDown(event: KeyboardEvent): void {
        if (event.srcElement === document.body) {
            if (event.keyCode === KeyCode.LEFT) {
                new Actions.CommonActions.ReferenceViewPanAndZoom(-0.6, 0).dispatch();
            }
            if (event.keyCode === KeyCode.RIGHT) {
                new Actions.CommonActions.ReferenceViewPanAndZoom(+0.6, 0).dispatch();
            }
        }
    }

    private onMouseWheel(event: React.WheelEvent<Element>): void {
        // Decide the zooming factor.
        new Actions.CommonActions.ReferenceViewPanAndZoom(0, event.deltaY / 1000, 'center').dispatch();
    }

    private detailedViewCursorPosition(event: React.MouseEvent<Element>): void {
        const x = this.getRelativePosition(event)[0];
        const t = x / this.props.viewWidth * (this.state.referenceTimestampEnd - this.state.referenceTimestampStart) +
            this.state.referenceTimestampStart;
        const timeWindow = stores.alignmentLabelingUiStore.referenceViewDuration;
        new Actions.CommonActions.SetReferenceViewZooming(t - timeWindow / 2, null, true).dispatch();
    }

    public componentDidMount(): void {
        super.componentDidMount();
        window.addEventListener('keydown', this.onKeyDown);
    }
    public componentWillUnmount(): void {
        super.componentWillUnmount();
        window.removeEventListener('keydown', this.onKeyDown);
    }

    private raiseOnDrag(mode: string, t0: number, t1: number): void {
        const newStart = Math.min(t0, t1);
        const newEnd = Math.max(t0, t1);
        if (mode === 'start' || mode === 'end') {
            new Actions.CommonActions.SetReferenceViewZooming(
                newStart,
                this.props.viewWidth / (newEnd - newStart)
            ).dispatch();
        } else {
            new Actions.CommonActions.SetReferenceViewZooming(
                newStart
            ).dispatch();
        }
    }

    private onStartDragRanges(event: React.MouseEvent<Element>, side: string): void {
        const x0 = event.screenX;
        const scaling = (this.state.referenceTimestampEnd - this.state.referenceTimestampStart) / this.props.viewWidth;
        const start0 = this.state.referenceViewStart;
        const end0 = this.state.referenceViewEnd;
        startDragging((mouseEvent: MouseEvent) => {
            const x1 = mouseEvent.screenX;
            let offset = (x1 - x0) * scaling;
            if (side === 'start') {
                this.raiseOnDrag(
                    'start',
                    Math.min(
                        this.state.referenceTimestampEnd,
                        Math.max(this.state.referenceTimestampStart, start0 + offset)),
                    end0);
            } else if (side === 'end') {
                this.raiseOnDrag(
                    'end',
                    start0,
                    Math.min(this.state.referenceTimestampEnd, Math.max(this.state.referenceTimestampStart, end0 + offset)));
            } else {
                offset = Math.max(
                    offset,
                    Math.max(this.state.referenceTimestampStart - start0, this.state.referenceTimestampStart - end0));
                offset = Math.min(
                    offset,
                    Math.min(this.state.referenceTimestampEnd - start0, this.state.referenceTimestampEnd - end0));
                this.raiseOnDrag('both', start0 + offset, end0 + offset);
            }
        });
    }

    private getRelativePosition(event: React.MouseEvent<Element>): number[] {
        const x: number = event.clientX - this.refs.interactionRect.getBoundingClientRect().left;
        const y: number = event.clientY - this.refs.interactionRect.getBoundingClientRect().top;
        return [x, y];
    }

    private onMouseMove(event: React.MouseEvent<Element>): void {
        const x = this.getRelativePosition(event)[0];
        const t = x / this.props.viewWidth * (this.state.referenceTimestampEnd - this.state.referenceTimestampStart) +
            this.state.referenceTimestampStart;
        new Actions.CommonActions.SetReferenceViewTimeCursor(t).dispatch();
    }

    public render(): JSX.Element {
        if (!this.state.referenceTrack) { return (<g></g>); }

        const xScale = d3.scaleLinear()
            .domain([this.state.referenceTimestampStart, this.state.referenceTimestampEnd])
            .range([0, this.props.viewWidth]);

        const videoHeight = LayoutParameters.referenceOverviewViewVideoHeight;
        const viewHeight = this.props.viewHeight;

        // Layout parameters.
        const videoY0 = 0;
        const videoY1 = videoHeight;
        const labelsY0 = videoY1;
        const labelsY1 = viewHeight;

        const rangeX0 = xScale(this.state.referenceViewStart);
        const rangeX1 = xScale(this.state.referenceViewEnd);

        const pathD = makePathDFromPoints([
            [xScale.range()[0], this.props.viewHeight],
            [rangeX0, this.props.viewHeight], [rangeX0, 0],
            [rangeX1, 0], [rangeX1, this.props.viewHeight],
            [xScale.range()[1], this.props.viewHeight]
        ]);

        return (
            <g className='labeling-overview-view'>
                <g className='labels' transform={`translate(0, ${videoY0})`}>
                    <TrackView
                        track={this.state.referenceTrack}
                        viewWidth={this.props.viewWidth}
                        viewHeight={videoY1 - videoY0}
                        zoomTransform={ts => ({
                            rangeStart: this.state.referenceTimestampStart,
                            pixelsPerSecond: this.props.viewWidth /
                            (this.state.referenceTimestampEnd - this.state.referenceTimestampStart)
                        })}
                        useMipmap={true}
                        />
                </g>
                <g className='labels' transform={`translate(0, ${labelsY0})`}>
                    {
                        stores.alignmentLabelingStore.tracks.map((track) => {
                            return (
                                <TrackView
                                    key={track.id}
                                    track={track}
                                    viewWidth={this.props.viewWidth}
                                    viewHeight={labelsY1 - labelsY0}
                                    zoomTransform={ts => ({
                                        rangeStart: this.state.referenceTimestampStart,
                                        pixelsPerSecond: this.props.viewWidth /
                                        (this.state.referenceTimestampEnd - this.state.referenceTimestampStart)
                                    })}
                                    useMipmap={true}
                                    filterTimeSeries={(series) => series.aligned}
                                    colorScale={this.props.mode === 'labeling' ?
                                        LayoutParameters.seriesColorScale : null}
                                    />
                            );
                        })
                    }
                    {
                        this.props.mode === 'labeling' ? (
                            <LabelsRangePlot
                                rangeStart={this.state.referenceTimestampStart}
                                pixelsPerSecond={this.props.viewWidth /
                                    (this.state.referenceTimestampEnd - this.state.referenceTimestampStart)}
                                plotWidth={this.props.viewWidth}
                                plotHeight={labelsY1 - labelsY0}
                                labelKind={LabelKind.Overview}
                                highlightLeastConfidentSuggestions={false}
                                />
                        ) : null
                    }
                </g>

                <TimeAxis scale={xScale} transform='translate(0, 0)' />

                <g
                    onMouseMove={event => this.onMouseMove(event)}
                    onWheel={event => this.onMouseWheel(event)}
                    >
                    <rect ref='interactionRect'
                        x={0} y={0} width={this.props.viewWidth} height={this.props.viewHeight}
                        style={{ fill: 'none', stroke: 'none', pointerEvents: 'all', cursor: 'crosshair' }}
                        />
                    <g className='track-cover' transform='translate(0, 0)'>
                        <rect x={0} y={0}
                            width={rangeX0}
                            height={this.props.viewHeight}
                            onClick={(e) => this.detailedViewCursorPosition(e)} />
                        <rect x={rangeX1} y={0}
                            width={this.props.viewWidth - rangeX1}
                            height={this.props.viewHeight}
                            onClick={(e) => this.detailedViewCursorPosition(e)} />
                    </g>
                </g>

                <g className='time-cursor' transform='translate(0, 0)'>
                    <line className='bg'
                        x1={xScale(this.state.referenceTimeCursor)}
                        y1={0}
                        x2={xScale(this.state.referenceTimeCursor)}
                        y2={this.props.viewHeight}
                        />
                    <line
                        x1={xScale(this.state.referenceTimeCursor)}
                        y1={0}
                        x2={xScale(this.state.referenceTimeCursor)}
                        y2={this.props.viewHeight}
                        />
                </g>

                <g className='brackets' transform='translate(0, 0)'>
                    <rect x={rangeX0} y={0} width={rangeX1 - rangeX0} height={this.props.viewHeight}
                        onMouseDown={event => this.onStartDragRanges(event, 'both')}
                        onMouseMove={event => this.onMouseMove(event)}
                        onWheel={event => this.onMouseWheel(event)}
                        />
                    <path d={pathD} className='frame-fg' />
                    <path d={`M0,0 L0,${this.props.viewHeight}`} transform={`translate(${rangeX0},0)`}
                        onMouseDown={event => this.onStartDragRanges(event, 'start')}
                        onMouseMove={event => this.onMouseMove(event)}
                        onWheel={event => this.onMouseWheel(event)}
                        />
                    <path d={`M0,0 L0,${this.props.viewHeight}`} transform={`translate(${rangeX1},0)`}
                        onMouseDown={event => this.onStartDragRanges(event, 'end')}
                        onMouseMove={event => this.onMouseMove(event)}
                        onWheel={event => this.onMouseWheel(event)}
                        />
                </g>
            </g>
        );
    }
}
