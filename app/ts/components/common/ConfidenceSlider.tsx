// Slider to adjust suggestion confidence threshold.

import {startDragging} from '../../common/common';
import * as d3 from 'd3';
import * as React from 'react';


interface ConfidenceSliderProps {
    value: number;
    min: number;
    max: number;
    histogram: number[];
    viewWidth: number;
    viewHeight: number;

    onChange?: (newValue: number) => void;
}

export class ConfidenceSlider extends React.Component<ConfidenceSliderProps, {}> {
    // constructor(props: IConfidenceSliderProps, context) {
    //     super();
    // }

    private onMouseDown(event: React.MouseEvent): void {
        const v0 = this.props.value;
        const circleRadius = 10;
        const xScale = d3.scale.linear()
            .domain([this.props.min, this.props.max])
            .range([circleRadius + 1, this.props.viewWidth - 1 - circleRadius]);
        const x0 = event.screenX;
        startDragging((emove: MouseEvent) => {
            const dx = emove.screenX - x0;
            let v1 = xScale.invert(xScale(v0) + dx);
            v1 = Math.min(this.props.max, Math.max(this.props.min, v1));
            if (this.props.onChange) { this.props.onChange(v1); }
        });
    }

    public render(): JSX.Element {
        const circleRadius = 10;
        const sliderY = this.props.viewHeight - circleRadius - 1;
        const histogramY = sliderY;
        const histogramHeight = histogramY - 1;

        let histogramMax = this.props.histogram.reduce((a, b) => Math.max(a, b), 0);
        if (histogramMax === 0) { histogramMax = 1; }

        const xScale = d3.scale.linear()
            .domain([this.props.min, this.props.max])
            .range([circleRadius + 1, this.props.viewWidth - 1 - circleRadius]);
        const histogramIndexToRange = d3.scale.linear()
            .domain([0, this.props.histogram.length - 1])
            .range([this.props.min, this.props.max]);

        return (
            <svg width={this.props.viewWidth} height={this.props.viewHeight} className='confidence-slider'>
                {
                    this.props.histogram.map((value, index) => (
                        <rect
                            key={`bin-${index}`}
                            className='histogram-bin'
                            x={xScale(histogramIndexToRange(index)) }
                            width={xScale(histogramIndexToRange(index + 1)) - xScale(histogramIndexToRange(index)) }
                            y={histogramY - value / histogramMax * histogramHeight}
                            height={value / histogramMax * histogramHeight}
                            />
                    ))
                }
                <line x1={xScale.range()[0]} x2={xScale.range()[1]} y1={sliderY} y2={sliderY} />
                <circle cx={xScale(this.props.value) } cy={sliderY} r={circleRadius}
                    onMouseDown={event => this.onMouseDown(event) }/>
            </svg>
        );
    }
}
