// The video track in the app.

import * as Actions from '../actions/Actions';
import { startDragging, Track } from '../common/common';
import * as stores from '../stores/stores';
import { EventListenerComponent } from './common/EventListenerComponent';
import { TimeAxis } from './common/TimeAxis';
import { TrackView } from './common/TrackView';
import * as d3 from 'd3';
import * as React from 'react';


export interface ReferenceTrackDetailProps {
    mode: string;
    viewWidth: number;
    viewHeight: number;
}


interface ReferenceTrackDetailState {
    referenceTrack: Track;
    // Time range.
    referenceTimestampStart: number;
    referenceTimestampEnd: number;
    referenceViewStart: number;
    referenceViewEnd: number;
    referenceViewPPS: number;

    referenceTimeCursor: number;
}


export class ReferenceTrackDetail extends EventListenerComponent<ReferenceTrackDetailProps, ReferenceTrackDetailState> {
    public refs: {
        [key: string]: Element,
        interactionRect: Element
    };

    constructor(props: ReferenceTrackDetailProps, context: any) {
        super(props, context, [
            stores.alignmentLabelingUiStore.referenceViewTimeCursorChanged,
            stores.alignmentLabelingUiStore.referenceViewChanged
        ]);
        this.state = this.computeState();
        this.updateState = this.updateState.bind(this);
    }

    private computeState(): ReferenceTrackDetailState {
        return {
            referenceTrack: stores.alignmentLabelingStore.referenceTrack,
            referenceTimestampStart: stores.alignmentLabelingUiStore.referenceTimestampStart,
            referenceTimestampEnd: stores.alignmentLabelingUiStore.referenceTimestampEnd,
            referenceViewStart: stores.alignmentLabelingUiStore.referenceViewStart,
            referenceViewEnd: stores.alignmentLabelingUiStore.referenceViewEnd,
            referenceViewPPS: stores.alignmentLabelingUiStore.referenceViewPPS,
            referenceTimeCursor: stores.alignmentLabelingUiStore.referenceViewTimeCursor
        };
    }

    protected updateState(): void {
        this.setState(this.computeState());
    }

    private onMouseWheel(event: React.WheelEvent<Element>): void {
        // Decide the zooming factor.
        new Actions.CommonActions.ReferenceViewPanAndZoom(0, event.deltaY / 1000, 'cursor').dispatch();
    }

    private getRelativePosition(event: { clientX: number; clientY: number; }): number[] {
        const x: number = event.clientX - this.refs.interactionRect.getBoundingClientRect().left;
        const y: number = event.clientY - this.refs.interactionRect.getBoundingClientRect().top;
        return [x, y];
    }

    private onMouseMove(event: React.MouseEvent<Element>): void {
        const x = this.getRelativePosition(event)[0];
        const t = x / this.props.viewWidth * (this.state.referenceViewEnd - this.state.referenceViewStart) +
            this.state.referenceViewStart;
        new Actions.CommonActions.SetReferenceViewTimeCursor(t).dispatch();
    }

    private onClickTrack(t: number): void {
        if (this.props.mode === 'alignment') {
            new Actions.AlignmentActions.AddMarker({
                timeSeries: stores.alignmentLabelingStore.referenceTrack.alignedTimeSeries[0],
                localTimestamp: t
            }).dispatch();
        }
    }

    private onMouseDown(event: React.MouseEvent<Element>): void {
        const [x0, y0] = this.getRelativePosition(event);
        const scaleXToTime = d3.scaleLinear()
            .domain([0, this.props.viewWidth])
            .range([this.state.referenceViewStart, this.state.referenceViewEnd]);
        const start0 = this.state.referenceViewStart;
        const pps0 = this.state.referenceViewPPS;
        const t0 = scaleXToTime(x0);
        let moved = false;
        startDragging(
            moveEvent => {
                const [x1, y1] = this.getRelativePosition(moveEvent);
                if (moved || Math.abs(y1 - y0) >= 3 || Math.abs(x1 - x0) >= 3) {
                    const t1 = scaleXToTime(x1);
                    const dt = t1 - t0;
                    new Actions.CommonActions.SetReferenceViewZooming(start0 - dt, pps0).dispatch();
                    moved = true;
                }
            },
            () => {
                if (!moved) {
                    this.onClickTrack(t0);
                }
            });
    }

    public render(): JSX.Element {
        if (!this.state.referenceTrack) { return (<g></g>); }

        const scale = d3.scaleLinear()
            .domain([this.state.referenceViewStart, this.state.referenceViewEnd])
            .range([0, this.props.viewWidth]);

        return (
            <g className='labeling-overview-view' transform={'translate(0, 23)'}>

                <TimeAxis scale={scale} transform={'translate(0,0)'} />

                <g className='labels'>
                    <TrackView
                        track={this.state.referenceTrack}
                        viewWidth={this.props.viewWidth}
                        viewHeight={this.props.viewHeight}
                        zoomTransform={ts => ({
                            rangeStart: this.state.referenceViewStart,
                            pixelsPerSecond: this.state.referenceViewPPS
                        })}
                        getTimeCursor={() => stores.alignmentLabelingUiStore.referenceViewTimeCursor}
                        useMipmap={true}
                        />
                </g>

                <g
                    onMouseMove={event => this.onMouseMove(event)}
                    onMouseDown={event => this.onMouseDown(event)}
                    onWheel={event => this.onMouseWheel(event)}
                    >
                    <rect ref='interactionRect'
                        x={0} y={0} width={this.props.viewWidth} height={this.props.viewHeight}
                        style={{
                            fill: 'none',
                            stroke: 'none',
                            pointerEvents: 'all',
                            cursor: this.props.mode === 'labeling' ? '-webkit-grab' : 'crosshair'
                        }}
                        />
                </g>
            </g>
        );
    }
}
