import { SignalsViewMode } from '../../stores/dataStructures/labeling';
import * as stores from '../../stores/stores';
import { projectStore, projectUiStore } from '../../stores/stores';
import { observer } from 'mobx-react';
import * as React from 'react';

@observer
export class OptionsToolbar extends React.Component<{}, {}> {

    private setViewModeThunk: { [viewMode: number]: () => void } = {};
    private changeFadeVideo(): void {
        projectStore.fadeBackground(!projectStore.shouldFadeVideoBackground);
    }

    constructor(props: {}, context: any) {
        super(props, context);

        Object.keys(SignalsViewMode).forEach(name => {
            const val = SignalsViewMode[name];
            this.setViewModeThunk[val] = this.setViewMode.bind(this, val);
        });
    }

    private setViewMode(viewMode: SignalsViewMode): void {
        stores.labelingUiStore.setSignalsViewMode(viewMode);
    }

    public render(): JSX.Element {
        const viewModeClassName = (mode: SignalsViewMode) => {
            return stores.labelingUiStore.signalsViewMode === mode ? 'visible' : 'hidden';
        };
        return (
            <div className='pull-right'>
                 <button className='tbtn tbtn-l3'
                    onClick={stores.projectStore.labelingUndo}>
                        Undo
                </button>
                <span className='message' style={{marginRight: '5pt'}}>{projectStore.statusMessage}</span>
                    <div className='btn-group'>
                        <button className='tbtn tbtn-l3 dropdown-toggle' data-toggle='dropdown' title='Options'>
                            <span className='glyphicon icon-only glyphicon-cog'></span>
                        </button>
                        <ul className='dropdown-menu options-menu'>
                            <li className='dropdown-header'>Signals Display</li>
                            <li className='option-item'
                                role='button'
                                onClick={this.setViewModeThunk[SignalsViewMode.TIMESERIES]}>
                                  <span className='glyphicon icon-only glyphicon-ok'
                                    style={{visibility: `${viewModeClassName(SignalsViewMode.TIMESERIES)}`, marginRight: '5pt'}}/>
                                Time series
                            </li>
                            <li className='option-item'
                                role='button'
                                onClick={this.setViewModeThunk[SignalsViewMode.AUTOCORRELOGRAM]}>
                                  <span className='glyphicon icon-only glyphicon-ok'
                                            style={{
                                                visibility: `${viewModeClassName(SignalsViewMode.AUTOCORRELOGRAM)}`,
                                                marginRight: '5pt'}
                                                }>
                                </span>
                                Autocorrelogram
                            </li>
                            <li className='option-item'
                                role='button'
                                onClick={this.setViewModeThunk[SignalsViewMode.COMBINED]}>
                                  <span className='glyphicon icon-only glyphicon-ok'
                                            style={{
                                                visibility: `${viewModeClassName(SignalsViewMode.COMBINED)}`,
                                                marginRight: '5pt'}
                                                }>
                                </span>
                                Both
                            </li>
                            <li role='separator' className='divider'></li>
                            <li className='dropdown-header'>Video Display</li>
                            <li className='option-item'
                                role='button'
                                onClick={this.changeFadeVideo}>
                                    <span style={{visibility: projectStore.referenceTrack ? 'visible' : 'hidden'}}>
                                        <span className='glyphicon icon-only glyphicon-ok'
                                            style={{
                                                visibility: projectStore.shouldFadeVideoBackground ? 'visible' : 'hidden',
                                                marginRight: '5pt'}
                                                }>
                                        </span>
                                        Emphasize motion
                                    </span>
                            </li>
                        </ul>
                    </div>
                    <span className='sep' />
                    <button className='tbtn tbtn-l3' title='Zoom in'
                        onClick={() => {
                            projectUiStore.zoomReferenceTrack(-0.2, 'center');
                        }}>
                        <span className='glyphicon icon-only glyphicon-zoom-in'></span>
                    </button>
                    <button className='tbtn tbtn-l3' title='Zoom out'
                        onClick={() => {
                            projectUiStore.zoomReferenceTrack(+0.2, 'center');
                        }}>
                        <span className='glyphicon icon-only glyphicon-zoom-out'></span>
                    </button>
                    <span className='sep' />
                    <button className='tbtn tbtn-l3' title='Go to the beginning'
                        onClick={() => {
                            projectUiStore.zoomReferenceTrackByPercentage(-1e10);
                        }}>
                        <span className='glyphicon icon-only glyphicon-fast-backward'></span>
                    </button>
                    <button className='tbtn tbtn-l3' title='Go to the previous page'
                        onClick={() => {
                            projectUiStore.zoomReferenceTrackByPercentage(-0.6);
                        }}>
                        <span className='glyphicon icon-only glyphicon-backward'></span>
                    </button>
                    <button className='tbtn tbtn-l3' title='Go to the next page'
                        onClick={() => {
                            projectUiStore.zoomReferenceTrackByPercentage(+0.6);
                        }}>
                        <span className='glyphicon icon-only glyphicon-forward'></span>
                    </button>
                    <button className='tbtn tbtn-l3' title='Go to the end'
                        onClick={() => {
                            projectUiStore.zoomReferenceTrackByPercentage(+1e10);
                        }}>
                        <span className='glyphicon icon-only glyphicon-fast-forward'></span>
                    </button>
            </div>
        );
    }
}
