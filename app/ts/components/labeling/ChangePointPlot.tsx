// Plot change points detection results.

import * as stores from '../../stores/stores';
import {EventListenerComponent} from '../common/EventListenerComponent';
import * as React from 'react';



interface ChangePointPlotProps {
    timestamps: number[];
    // Zooming factor.
    pixelsPerSecond: number;
    // Height of the rendered label.
    height: number;
}


export class ChangePointPlot extends React.Component<ChangePointPlotProps, {}> {

    public shouldComponentUpdate(nextProps: ChangePointPlotProps): boolean {
        return this.props.pixelsPerSecond !== nextProps.pixelsPerSecond ||
            this.props.height !== nextProps.height ||
            this.props.timestamps !== nextProps.timestamps;
    }

    public render(): JSX.Element {
        const timestamps = this.props.timestamps || [];
        const items = timestamps.map((t, index) => {
            return (
                <line
                    key={`cp-${index}`}
                    x1={this.props.pixelsPerSecond * t}
                    x2={this.props.pixelsPerSecond * t}
                    y1={0}
                    y2={this.props.height}
                    />
            );
        });
        return (
            <g>
                {items}
            </g>
        );
    }
}

interface ChangePointRangePlotProps {
    // Zooming factor.
    rangeStart: number;
    pixelsPerSecond: number;
    // Height of the rendered label.
    plotHeight: number;
    plotWidth: number;
}



interface ChangePointRangePlotState {
    timestamps: number[];
}



export class ChangePointRangePlot extends EventListenerComponent<ChangePointRangePlotProps, ChangePointRangePlotState> {
    constructor(props: ChangePointRangePlotProps, context: any) {
        super(props, context, [stores.labelingStore.suggestedChangePointsChanged]);

        this.state = {
            timestamps: stores.labelingStore.changePoints
        };
    }

    protected updateState(): void {
        this.setState({
            timestamps: stores.labelingStore.changePoints
        });
    }

    public componentWillReceiveProps(newProps: ChangePointRangePlotProps): void {
        this.setState({
            timestamps: stores.labelingStore.changePoints
        });
    }


    public render(): JSX.Element {
        return (
            <g className='changepoints' transform={`translate(${-this.props.pixelsPerSecond * this.props.rangeStart},0)`}>
                <ChangePointPlot
                    timestamps={this.state.timestamps}
                    pixelsPerSecond={this.props.pixelsPerSecond}
                    height={this.props.plotHeight}
                    />
            </g>
        );
    }
}
