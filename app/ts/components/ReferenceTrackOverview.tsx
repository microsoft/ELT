// The 'Overview' view that is shared by both alignment and labeling.

import { Track } from '../stores/dataStructures/alignment';
import { LayoutParameters } from '../stores/dataStructures/LayoutParameters';
import { KeyCode } from '../stores/dataStructures/types';
import * as stores from '../stores/stores';
import { makePathDFromPoints, startDragging } from '../stores/utils';
import { TimeAxis } from './common/TimeAxis';
import { TrackView } from './common/TrackView';
import { LabelKind } from './labeling/LabelPlot';
import { LabelsRangePlot } from './labeling/LabelsRangePlot';
import * as d3 from 'd3';
import { observer } from 'mobx-react';
import * as React from 'react';


export interface ReferenceTrackOverviewProps {
    mode: string;
    viewWidth: number;
    viewHeight: number;
    downReach: number;
}


@observer
export class ReferenceTrackOverview extends React.Component<ReferenceTrackOverviewProps, {}> {
    public refs: {
        [key: string]: Element,
        interactionRect: Element
    };

    constructor(props: ReferenceTrackOverviewProps, context: any) {
        super(props, context);
        this.onKeyDown = this.onKeyDown.bind(this);
    }

    private onKeyDown(event: KeyboardEvent): void {
        if (event.srcElement === document.body) {
            if (event.keyCode === KeyCode.LEFT) {
                stores.alignmentLabelingUiStore.referenceViewPanAndZoom(-0.6, 0);
                stores.uiStore.referenceViewPanAndZoom(-0.6, 0);
            }
            if (event.keyCode === KeyCode.RIGHT) {
                stores.alignmentLabelingUiStore.referenceViewPanAndZoom(+0.6, 0);
                stores.uiStore.referenceViewPanAndZoom(+0.6, 0);
            }
        }
    }

    private onMouseWheel(event: React.WheelEvent<Element>): void {
        // Decide the zooming factor.
        stores.alignmentLabelingUiStore.referenceViewPanAndZoom(0, event.deltaY / 1000, 'center');
        stores.uiStore.referenceViewPanAndZoom(0, event.deltaY / 1000, 'center');
    }

    private detailedViewCursorPosition(event: React.MouseEvent<Element>): void {
        const x = this.getRelativePosition(event)[0];
        const start = stores.alignmentLabelingStore.referenceTimestampStart;
        const end = stores.alignmentLabelingStore.referenceTimestampEnd;
        const t = x / this.props.viewWidth * (end - start) + start;
        const timeWindow = stores.alignmentLabelingUiStore.referenceViewDuration;
        stores.alignmentLabelingUiStore.setReferenceViewZoomingAction(t - timeWindow / 2, null, true);
    }

    public componentDidMount(): void {
        window.addEventListener('keydown', this.onKeyDown);
    }

    public componentWillUnmount(): void {
        window.removeEventListener('keydown', this.onKeyDown);
    }

    private raiseOnDrag(mode: string, t0: number, t1: number): void {
        const newStart = Math.min(t0, t1);
        const newEnd = Math.max(t0, t1);
        if (mode === 'start' || mode === 'end') {
            stores.alignmentLabelingUiStore.setReferenceViewZoomingAction(newStart, this.props.viewWidth / (newEnd - newStart));
        } else {
            stores.alignmentLabelingUiStore.setReferenceViewZoomingAction(newStart);
        }
    }

    private onStartDragRanges(event: React.MouseEvent<Element>, side: string): void {
        const x0 = event.screenX;
        const start = stores.alignmentLabelingStore.referenceTimestampStart;
        const end = stores.alignmentLabelingStore.referenceTimestampEnd;
        const scaling = (end - start) / this.props.viewWidth;
        const start0 = stores.alignmentLabelingUiStore.referenceViewStart;
        const end0 = stores.alignmentLabelingUiStore.referenceViewStart +
                this.props.viewWidth / stores.alignmentLabelingUiStore.referenceViewPPS;
        startDragging((mouseEvent: MouseEvent) => {
            const x1 = mouseEvent.screenX;
            let offset = (x1 - x0) * scaling;
            if (side === 'start') {
                this.raiseOnDrag(
                    'start',
                    Math.min(end, Math.max(start, start0 + offset)),
                    end0);
            } else if (side === 'end') {
                this.raiseOnDrag(
                    'end',
                    start0,
                    Math.min(end, Math.max(start, end0 + offset)));
            } else {
                offset = Math.max(
                    offset,
                    Math.max(start - start0, start - end0));
                offset = Math.min(
                    offset,
                    Math.min(end - start0, end - end0));
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
        const start = stores.alignmentLabelingStore.referenceTimestampStart;
        const end = stores.alignmentLabelingStore.referenceTimestampEnd;
        const t = x / this.props.viewWidth * (end - start) + start;
        stores.alignmentLabelingUiStore.setReferenceViewTimeCursor(t);
        stores.uiStore.setReferenceViewTimeCursor(t);
    }

    public render(): JSX.Element {
        if (!stores.alignmentLabelingStore.referenceTrack) { return (<g></g>); }

        const start = stores.alignmentLabelingStore.referenceTimestampStart;
        const end = stores.alignmentLabelingStore.referenceTimestampEnd;
        const xScale = d3.scaleLinear()
            .domain([start, end])
            .range([0, this.props.viewWidth]);

        const videoHeight = LayoutParameters.referenceOverviewViewVideoHeight;
        const viewHeight = this.props.viewHeight;

        // Layout parameters.
        const videoY0 = 0;
        const videoY1 = videoHeight;
        const labelsY0 = videoY1;
        const labelsY1 = viewHeight;

        const rangeX0 = xScale(stores.alignmentLabelingUiStore.referenceViewStart);
        const rangeX1 = xScale(stores.alignmentLabelingUiStore.referenceViewStart +
                this.props.viewWidth / stores.alignmentLabelingUiStore.referenceViewPPS);

        const pathD = makePathDFromPoints([
            [xScale.range()[0], this.props.viewHeight],
            [rangeX0, this.props.viewHeight], [rangeX0, 0],
            [rangeX1, 0], [rangeX1, this.props.viewHeight],
            [xScale.range()[1], this.props.viewHeight]
        ]);

        const cursor = stores.alignmentLabelingUiStore.referenceViewTimeCursor;

        return (
            <g className='labeling-overview-view'>
                <g className='labels' transform={`translate(0, ${videoY0})`}>
                    <TrackView
                        track={stores.alignmentLabelingStore.referenceTrack}
                        viewWidth={this.props.viewWidth}
                        viewHeight={videoY1 - videoY0}
                        zoomTransform={ts => ({
                            rangeStart: start,
                            pixelsPerSecond: this.props.viewWidth / (end - start)
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
                                        rangeStart: start,
                                        pixelsPerSecond: this.props.viewWidth / (end - start)
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
                                rangeStart={start}
                                pixelsPerSecond={this.props.viewWidth / (end - start)}
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
                        x1={xScale(cursor)}
                        y1={0}
                        x2={xScale(cursor)}
                        y2={this.props.viewHeight}
                        />
                    <line
                        x1={xScale(cursor)}
                        y1={0}
                        x2={xScale(cursor)}
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
