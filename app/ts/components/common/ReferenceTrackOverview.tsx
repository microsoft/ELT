import { getLabelKey } from '../../stores/dataStructures/labeling';
import { PanZoomParameters } from '../../stores/dataStructures/PanZoomParameters';
import * as stores from '../../stores/stores';
import { makePathDFromPoints, startDragging } from '../../stores/utils';
import { LabelType, LabelView } from '../labeling/LabelView';
import { TimeAxis } from './TimeAxis';
import { TrackView } from './TrackView';
import * as d3 from 'd3';
import { observer } from 'mobx-react';
import * as React from 'react';


export interface ReferenceTrackOverviewProps {
    mode: string;
    viewWidth: number;
    viewHeight: number;
    downReach: number;
}

// The 'Overview' view that is shared by both alignment and labeling.
@observer
export class ReferenceTrackOverview extends React.Component<ReferenceTrackOverviewProps, {}> {
    public refs: {
        [key: string]: Element,
        interactionRect: Element
    };

    constructor(props: ReferenceTrackOverviewProps, context: any) {
        super(props, context);
        // this.onKeyDown = this.onKeyDown.bind(this);
    }

    private onMouseWheel(event: React.WheelEvent<Element>): void {
        // Decide the zooming factor.
        stores.projectUiStore.zoomReferenceTrack(event.deltaY / 1000, 'center');
    }

    private detailedViewCursorPosition(event: React.MouseEvent<Element>): void {
        const x = this.getRelativePosition(event)[0];
        const t = x / this.props.viewWidth * (stores.projectStore.referenceTimestampEnd - stores.projectStore.referenceTimestampStart) +
            stores.projectStore.referenceTimestampStart;
        const timeWindow = stores.projectUiStore.referenceTrackDuration;
        stores.projectUiStore.setReferenceTrackPanZoom(
            new PanZoomParameters(t - timeWindow / 2, null), true);
    }

    private raiseOnDrag(mode: string, t0: number, t1: number): void {
        const newStart = Math.min(t0, t1);
        const newEnd = Math.max(t0, t1);
        if (mode === 'start' || mode === 'end') {
            stores.projectUiStore.setReferenceTrackPanZoom(
                new PanZoomParameters(newStart, this.props.viewWidth / (newEnd - newStart)));
        } else {
            stores.projectUiStore.setReferenceTrackPanZoom(
                new PanZoomParameters(newStart, 0));
        }
    }

    private onStartDragRanges(event: React.MouseEvent<Element>, side: string): void {
        const x0 = event.screenX;
        const start = stores.projectStore.referenceTimestampStart;
        const end = stores.projectStore.referenceTimestampEnd;
        const scaling = (end - start) / this.props.viewWidth;
        const start0 = stores.projectUiStore.referenceTrackPanZoom.rangeStart;
        const end0 = stores.projectUiStore.referenceTrackPanZoom.rangeStart +
            this.props.viewWidth / stores.projectUiStore.referenceTrackPanZoom.pixelsPerSecond;
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
        const t = x / this.props.viewWidth * (stores.projectStore.referenceTimestampEnd - stores.projectStore.referenceTimestampStart) +
            stores.projectStore.referenceTimestampStart;
        stores.projectUiStore.setReferenceTrackTimeCursor(t);
    }

    public render(): JSX.Element {
        if (!stores.projectStore.referenceTrack) { return (<g></g>); }

        const start = stores.projectStore.referenceTimestampStart;
        const end = stores.projectStore.referenceTimestampEnd;
        const xScale = d3.scaleLinear()
            .domain([start, end])
            .range([0, this.props.viewWidth]);

        const videoHeight = 50;
        const viewHeight = this.props.viewHeight;

        // Layout parameters.
        const videoY0 = 0;
        const videoY1 = videoHeight;
        const labelsY0 = videoY1;
        const labelsY1 = viewHeight;

        const panZoom = stores.projectUiStore.referenceTrackPanZoom;
        const rangeX0 = xScale(panZoom.rangeStart);
        const rangeX1 = xScale(panZoom.rangeStart + this.props.viewWidth / panZoom.pixelsPerSecond);

        const cursorX = xScale(stores.projectUiStore.referenceTrackTimeCursor);
        const globalPanZoom = new PanZoomParameters(0, this.props.viewWidth / (end - start));

        const labels = stores.labelingUiStore.getLabelsInRange(globalPanZoom.getTimeRangeToX(this.props.viewWidth));
        let labelsView = null;
        if (this.props.mode === 'labeling') {
            labelsView = (
                <g transform={`translate(${-globalPanZoom.pixelsPerSecond * globalPanZoom.rangeStart},0)`}>
                    {labels.map(label =>
                        <LabelView
                            key={getLabelKey(label)}
                            label={label}
                            pixelsPerSecond={globalPanZoom.pixelsPerSecond}
                            height={labelsY1 - labelsY0}
                            classColormap={stores.labelingStore.classColormap}
                            labelType={LabelType.Overview}
                        />
                    )}
                </g>
            );
        }

        return (
            <g className='labeling-overview-view'>
                <g className='labels' transform={`translate(0, ${videoY0})`}>
                    <TrackView
                        track={stores.projectStore.referenceTrack}
                        viewWidth={this.props.viewWidth}
                        viewHeight={videoY1 - videoY0}
                        zoomTransform={globalPanZoom}
                        useMipmap={true}
                        videoDetail={false}
                    />
                </g>
                <g className='labels' transform={`translate(0, ${labelsY0})`}>
                    {
                        stores.projectStore.tracks
                            .filter(track => track.isAlignedToReferenceTrack)
                            .map(track => {
                                return (
                                    <TrackView
                                        key={track.id}
                                        track={track}
                                        viewWidth={this.props.viewWidth}
                                        viewHeight={labelsY1 - labelsY0}
                                        zoomTransform={globalPanZoom}
                                        useMipmap={true}
                                    />
                                );
                            })
                    }
                    {labelsView}
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
                            onClick={e => this.detailedViewCursorPosition(e)} />
                        <rect x={rangeX1} y={0}
                            width={this.props.viewWidth - rangeX1}
                            height={this.props.viewHeight}
                            onClick={e => this.detailedViewCursorPosition(e)} />
                    </g>
                </g>

                {!isNaN(cursorX) ?
                    <g className='time-cursor' transform='translate(0, 0)'>
                        <line className='bg' x1={cursorX} y1={0} x2={cursorX} y2={this.props.viewHeight} />
                        <line x1={cursorX} y1={0} x2={cursorX} y2={this.props.viewHeight} />
                    </g> : null}

                <g className='brackets' transform='translate(0, 0)'>
                    <rect x={rangeX0} y={0} width={rangeX1 - rangeX0} height={this.props.viewHeight}
                        onMouseDown={event => this.onStartDragRanges(event, 'both')}
                        onMouseMove={event => this.onMouseMove(event)}
                        onWheel={event => this.onMouseWheel(event)}
                    />
                    <path
                        d={makePathDFromPoints([
                            [xScale.range()[0], this.props.viewHeight],
                            [rangeX0, this.props.viewHeight], [rangeX0, 0],
                            [rangeX1, 0], [rangeX1, this.props.viewHeight],
                            [xScale.range()[1], this.props.viewHeight]
                        ])}
                        className='frame-fg' />
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
