// NavigationColumn: the left navigation area.

import * as React from 'react';

export interface NavigationColumnProps {
    selected: string;
    onSelect?: (name: string) => any;
}

// Labeling app has some configuration code, then it calls LabelingView.
export class NavigationColumn extends React.Component<NavigationColumnProps, {}> {
    constructor(props: NavigationColumnProps, context: any) {
        super(props, context);
    }

    public render(): JSX.Element {
        const tabInfos = React.Children.map(this.props.children, (ch: React.ReactElement<NavigationColumnItemProps>, i: number) => {
            return {
                iconClass: ch.props.iconClass,
                name: ch.props.name,
                title: ch.props.title,
                showButton: ch.props.showButton === false ? false : true,
                child: ch
            };
        });

        const buttons = tabInfos.map((info) => {
            if (!info.showButton) { return null; }
            return (
                <div key={info.name} role='button'
                    className={`navigation-column-button ${info.name === this.props.selected ? 'active' : ''}`}
                    title={info.title}
                    onClick={event => { this.props.onSelect(info.name); } }>
                    <span className={`${info.iconClass}`}></span>
                </div>
            );
        });

        let selectedChild: React.ReactElement<NavigationColumnItemProps> = null;
        React.Children.forEach(this.props.children, (ch: React.ReactElement<NavigationColumnItemProps>) => {
            if (ch.props.name === this.props.selected) {
                selectedChild = ch;
            }
        });

        return (
            <div className='navigation-column'>
                <div className='navigation-column-column'>
                    {buttons}
                </div>
                {selectedChild}
            </div>
        );
    }
}

export interface NavigationColumnItemProps {
    name: string;
    title?: string;
    showButton?: boolean;
    iconClass: string; // the glyphicon class.
}

export class NavigationColumnItem extends React.Component<NavigationColumnItemProps, {}> {
    constructor(props: NavigationColumnItemProps, context: any) {
        super(props, context);
    }

    public render(): JSX.Element {
        return (
            <div className='navigation-column-container'>
                {this.props.children}
            </div>
        );
    }
}
