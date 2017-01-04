import * as React from 'react';

export interface DeploymentToolbarProps {
    top: number;
    left: number;
    viewWidth: number;
    viewHeight: number;
    compileClick: () => void;
    deployClick: () => void;
}

export class DeploymentToolbar extends React.Component<DeploymentToolbarProps, {}> {
    public render(): JSX.Element {
        return (
            <div className='labeling-toolbar-view form-inline' style={{
                position: 'absolute',
                top: this.props.top + 'px',
                left: this.props.left + 'px',
                width: this.props.viewWidth + 'px',
                height: this.props.viewHeight + 'px',
            }}>
                <div className='form-group-sm'>
                    <label className='col-sm-1 control-label' htmlFor='targetPlatform'>Target</label>
                    <select className='form-control col-xs-2' id='targetPlatform'>
                        <option>Arduino</option>
                        <option>Microbit</option>
                    </select>
                </div>
                <button className='tbtn tbtn-l3 breathing-room' title='Compile' type='button'
                    onClick={ () => this.props.compileClick() } >
                    Compile
                </button>
                <button className='tbtn tbtn-l3' title='Deploy' type='button'
                    onClick={ () => this.props.deployClick() } >
                    Deploy
                </button>
            </div>
        );
    }
}
