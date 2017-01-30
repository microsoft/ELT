import * as d3 from 'd3';
import * as React from 'react';

// Component TimeAxis.
export interface TimeAxisProps {
    scale: d3.ScaleLinear<number, number>;           // D3 scale for the axis.
    transform?: string;   // Transform.
}

interface TimeAxisState {
    axis: any;
}

export class TimeAxis extends React.Component<TimeAxisProps, TimeAxisState> {
    public refs: {
        [key: string]: Element,
        axisNode: Element
    };

    constructor(props: TimeAxisProps, context: any) {
        super(props, context);
        this.state = {
            axis: d3.axisTop(props.scale)
        };
    }

    public componentDidMount(): void {
        this.componentWillReceiveProps(this.props);
        this.renderAxis();
    }

    public componentDidUpdate(): void {
        this.renderAxis();
    }

    public componentWillReceiveProps(newProps: TimeAxisProps): void {
        const axis = d3.axisTop(newProps.scale)
            .ticks(newProps.scale.range()[1] / 50);
        const tickValues = newProps.scale.ticks(axis.tickArguments()[0]) as number[];
        for (let i = 0; i <= 3; i++) {
            const tf = d => d.toFixed(i) + 's';
            axis.tickFormat(tf);
            const s = tickValues.map(tf);
            if (s.every((x, j) => j === 0 || s[j - 1] !== s[j])) { break; }
        }
        this.setState({ axis: axis });
    }

    public renderAxis(): void {
        const axisNode = this.refs.axisNode;
        d3.select(axisNode).call(this.state.axis);
    }

    public render(): JSX.Element {
        return <g className='axis' ref='axisNode' transform={this.props.transform || ''} />;
    }
}
