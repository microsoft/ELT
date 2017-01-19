// The video track in the app.

import { Marker, Track } from '../stores/dataStructures/alignment';
import * as stores from '../stores/stores';
import { startDragging } from '../stores/utils';
import { TimeAxis } from './common/TimeAxis';
import { TrackView } from './common/TrackView';
import * as d3 from 'd3';
import { observer } from 'mobx-react';
import * as React from 'react';


export interface ReferenceTrackDetailProps {
    mode: string;
    viewWidth: number;
    viewHeight: number;
}


@observer
export class ReferenceTrackDetail extends React.Component<ReferenceTrackDetailProps, {}> {
    public refs: {
        [key: string]: Element,
        interactionRect: Element
    };

    private onMouseWheel(event: React.WheelEvent<Element>): void {
        // Decide the zooming factor.
        stores.alignmentLabelingUiStore.referenceViewPanAndZoom(0, event.deltaY / 1000, 'cursor');
        stores.uiStore.referenceViewPanAndZoom(0, event.deltaY / 1000, 'cursor');
    }

    private getRelativePosition(event: { clientX: number; clientY: number; }): number[] {
        const x: number = event.clientX - this.refs.interactionRect.getBoundingClientRect().left;
        const y: number = event.clientY - this.refs.interactionRect.getBoundingClientRect().top;
        return [x, y];
    }

    private onMouseMove(event: React.MouseEvent<Element>): void {
        const x = this.getRelativePosition(event)[0];
        const start = stores.alignmentLabelingUiStore.referenceViewStart;
        const end = stores.alignmentLabelingUiStore.referenceViewEnd;
        const t = x / this.props.viewWidth * (end - start) + start;
        stores.alignmentLabelingUiStore.setReferenceViewTimeCursor(t);
        stores.uiStore.setReferenceViewTimeCursor(t);
    }

    private onClickTrack(t: number): void {
        if (this.props.mode === 'alignment') {
            const marker: Marker = {
                timeSeries: stores.alignmentLabelingStore.referenceTrack.alignedTimeSeries[0],
                localTimestamp: t
            };
            stores.alignmentStore.addMarker(marker);
        }
    }

    private onMouseDown(event: React.MouseEvent<Element>): void {
        const [x0, y0] = this.getRelativePosition(event);
        const start = stores.alignmentLabelingUiStore.referenceViewStart;
        const end = stores.alignmentLabelingUiStore.referenceViewEnd;
        const scaleXToTime = d3.scaleLinear()
            .domain([0, this.props.viewWidth])
            .range([start, end]);
        const start0 = start;
        const pps0 = stores.alignmentLabelingUiStore.referenceViewPPS;
        const t0 = scaleXToTime(x0);
        let moved = false;
        startDragging(
            moveEvent => {
                const [x1, y1] = this.getRelativePosition(moveEvent);
                if (moved || Math.abs(y1 - y0) >= 3 || Math.abs(x1 - x0) >= 3) {
                    const t1 = scaleXToTime(x1);
                    const dt = t1 - t0;
                    stores.alignmentLabelingUiStore.setReferenceViewZooming(start0 - dt, pps0);
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
        if (!stores.alignmentLabelingStore.referenceTrack) { return (<g></g>); }

        const start = stores.alignmentLabelingUiStore.referenceViewStart;
        const end = stores.alignmentLabelingUiStore.referenceViewEnd;
        const scale = d3.scaleLinear()
            .domain([start, end])
            .range([0, this.props.viewWidth]);

        return (
            <g className='labeling-overview-view' transform={'translate(0, 23)'}>

                <TimeAxis scale={scale} transform={'translate(0,0)'} />

                <g className='labels'>
                    <TrackView
                        track={stores.alignmentLabelingStore.referenceTrack}
                        viewWidth={this.props.viewWidth}
                        viewHeight={this.props.viewHeight}
                        zoomTransform={ts => ({
                            rangeStart: start,
                            pixelsPerSecond: stores.alignmentLabelingUiStore.referenceViewPPS
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
