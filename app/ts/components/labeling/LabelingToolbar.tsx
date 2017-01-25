// The toolbar view for labeling.

import * as stores from '../../stores/stores';
import { labelingSuggestionGenerator } from '../../stores/stores';
import { InlineClassesListView } from './ClassesListView';
import { observer } from 'mobx-react';
import * as React from 'react';


export interface LabelingToolbarProps {
    top: number;
    left: number;
    viewWidth: number;
    viewHeight: number;
}


@observer
export class LabelingToolbar extends React.Component<LabelingToolbarProps, {}> {
    public refs: {
        [name: string]: Element,
        fileSelector: HTMLInputElement
    };

    public render(): JSX.Element {
        const timeCursor = stores.projectUiStore.referenceViewTimeCursor;
        return (
            <div className='labeling-toolbar-view' style={{
                position: 'absolute',
                top: this.props.top + 'px',
                left: this.props.left + 'px',
                width: this.props.viewWidth + 'px',
                height: this.props.viewHeight + 'px'
            }}>
                <button className='tbtn tbtn-l3' title='Zoom in'
                    onClick={() => {
                        stores.projectUiStore.referenceViewPanAndZoom(0, -0.2, 'center');
                    } }>
                    <span className='glyphicon icon-only glyphicon-zoom-in'></span></button>
                {' '}
                <button className='tbtn tbtn-l3' title='Zoom out'
                    onClick={() => {
                        stores.projectUiStore.referenceViewPanAndZoom(0, +0.2, 'center');
                    } }>
                    <span className='glyphicon icon-only glyphicon-zoom-out'></span></button>
                {' '}
                <span className='sep' />
                {' '}
                <button className='tbtn tbtn-l3' title='Go to the beginning'
                    onClick={() => {
                        stores.projectUiStore.referenceViewPanAndZoom(-1e10, 0);
                    } }>
                    <span className='glyphicon icon-only glyphicon-fast-backward'></span></button>
                {' '}
                <button className='tbtn tbtn-l3' title='Go to the previous page'
                    onClick={() => {
                        stores.projectUiStore.referenceViewPanAndZoom(-0.6, 0);
                    } }>
                    <span className='glyphicon icon-only glyphicon-backward'></span></button>
                {' '}
                <button className='tbtn tbtn-l3' title='Go to the next page'
                    onClick={() => {
                        stores.projectUiStore.referenceViewPanAndZoom(+0.6, 0);
                    } }>
                    <span className='glyphicon icon-only glyphicon-forward'></span></button>
                {' '}
                <button className='tbtn tbtn-l3' title='Go to the end'
                    onClick={() => {
                        stores.projectUiStore.referenceViewPanAndZoom(+1e10, 0);
                    } }>
                    <span className='glyphicon icon-only glyphicon-fast-forward'></span></button>
                {' '}
                <span className='sep' />
                {' '}
                <InlineClassesListView />
                {' '}
                <span className='sep' />
                {' '}
                <span>{stores.labelingStore.labels.length} labels.</span>
                {' '}
                <button className='tbtn tbtn-red' title='Delete all labels'
                    onClick={() => {
                        if (confirm('Are you sure to delete all labels?')) {
                            stores.labelingStore.removeAllLabels();
                        }
                    } }>
                    <span className='glyphicon icon-only glyphicon-trash'></span>
                </button>
                {' '}
                <span className='sep' />
                {' '}
                <span style={{ minWidth: '10em', display: 'inline-block' }}>
                    Cursor: {timeCursor ? timeCursor.toFixed(3) : 'null'}
                </span>
                {' '}
                <span className='sep' />
                {' '}
                Suggestions:
                {' '}
                <span className='tbtn-group'>
                    <button
                        type='button'
                        className={`tbtn ${stores.labelingUiStore.suggestionEnabled ? 'tbtn-l1 active' : 'tbtn-l3'}`}
                        onClick={() => stores.labelingUiStore.setSuggestionEnabled(true)}
                        >On</button>
                    <button
                        type='button'
                        className={`tbtn ${!stores.labelingUiStore.suggestionEnabled ? 'tbtn-l1 active' : 'tbtn-l3'}`}
                        onClick={() => {
                            stores.labelingUiStore.setSuggestionEnabled(false);
                            stores.labelingStore.removeAllSuggestions();
                            labelingSuggestionGenerator.removeAllSuggestions();
                        } }
                        >Off</button>
                </span>
                {' '}
                <button
                    type='button'
                    className='tbtn tbtn-red'
                    title='Confirm all suggested labels'
                    onClick={() => stores.labelingStore.confirmVisibleSuggestions()}
                    ><span className='glyphicon icon-only glyphicon-ok'></span></button>
            </div>
        );
    }
}
