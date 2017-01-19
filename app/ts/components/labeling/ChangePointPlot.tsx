// Plot change points detection results.

import * as stores from '../../stores/stores';
import { observer } from 'mobx-react';
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


@observer
export class ChangePointRangePlot extends React.Component<ChangePointRangePlotProps, {}> {

    public render(): JSX.Element {
        return (
            <g className='changepoints' transform={`translate(${-this.props.pixelsPerSecond * this.props.rangeStart},0)`}>
                <ChangePointPlot
                    timestamps={stores.labelingStore.changePoints}
                    pixelsPerSecond={this.props.pixelsPerSecond}
                    height={this.props.plotHeight}
                    />
            </g>
        );
    }
}
