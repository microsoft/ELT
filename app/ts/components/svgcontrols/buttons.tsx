// Buttons for use in SVG context.

import * as React from 'react';

export interface SVGTextButtonProps {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    className?: string;
    onClick?: (event: React.MouseEvent) => void;
    onMouseDown?: (event: React.MouseEvent) => void;
}

export class SVGTextButton extends React.Component<SVGTextButtonProps, {}> {
    public render(): JSX.Element {
        const className = ['svgbutton'];
        if (this.props.className) { className.push(this.props.className); }
        return (
            <g
                className={className.join(' ') }
                onClick={this.props.onClick}
                onMouseDown={this.props.onMouseDown}
                >
                <rect x={this.props.x} y={this.props.y} width={this.props.width} height={this.props.height} />
                <text x={this.props.x + this.props.width / 2} y={this.props.y + this.props.height / 2}>{this.props.text}</text>
            </g>
        );
    }
}

const glyphiconName2Char: { [name: string]: string } = {
    remove: '\ue014',
    minus: '\u2212',
    plus: '\u002b',
    'plus-sign': '\ue081',
    unchecked: '\ue157',
    'arrow-left': '\ue132'
};

export class SVGGlyphiconButton extends React.Component<SVGTextButtonProps, {}> {
    public render(): JSX.Element {
        const className = ['svgbutton'];
        if (this.props.className) { className.push(this.props.className); }
        return (
            <g
                className={className.join(' ') }
                onClick={this.props.onClick}
                onMouseDown={this.props.onMouseDown}
                >
                <rect x={this.props.x} y={this.props.y} width={this.props.width} height={this.props.height} />
                <text
                    x={this.props.x + this.props.width / 2}
                    y={this.props.y + this.props.height / 2}
                    style={{ fontFamily: 'Glyphicons Halflings' }}
                    >{glyphiconName2Char[this.props.text]}</text>
            </g>
        );
    }
}
