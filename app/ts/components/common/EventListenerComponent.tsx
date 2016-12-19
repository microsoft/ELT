import {NodeEvent} from '../../stores/NodeEvent';
import * as React from 'react';

export abstract class EventListenerComponent<P, S> extends React.Component<P, S> {

    constructor(props: P, context: any, private events: NodeEvent[]) {
        super(props, context);
        this.updateState = this.updateState.bind(this);
    }

    protected abstract updateState(): void;

    public componentDidMount(): void {
        this.events.forEach(ev => ev.on(this.updateState));
    }

    public componentWillUnmount(): void {
        this.events.forEach(ev => ev.off(this.updateState));
    }

}
