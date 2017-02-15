// The toolbar view for labeling.

import * as stores from '../../stores/stores';
import { labelingSuggestionGenerator } from '../../stores/stores';
import { ReferenceVideoToolbar } from '../common/ReferenceVideoToolbar';
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
        return (
            <div className='labeling-toolbar-view' style={{
                position: 'absolute',
                top: this.props.top + 'px',
                left: this.props.left + 'px',
                width: this.props.viewWidth + 'px',
                height: this.props.viewHeight + 'px'
            }}>
                <InlineClassesListView />
                <span className='sep' />
                <span>{stores.labelingStore.labels.length} labels.</span>
                <button className='tbtn tbtn-red' title='Delete all labels'
                    onClick={() => {
                        if (confirm('Are you sure to delete all labels?')) {
                            stores.labelingStore.removeAllLabels();
                        }
                    }}>
                    <span className='glyphicon icon-only glyphicon-trash'></span>
                </button>
                <span className='sep' />
                Suggestions:
                <span className='tbtn-group'>
                    <button
                        type='button'
                        className={`tbtn ${stores.labelingUiStore.suggestionEnabled ? 'tbtn-l1 active' : 'tbtn-l3'}`}
                        onClick={() => stores.labelingUiStore.suggestionEnabled = true}
                    >On</button>
                    <button
                        type='button'
                        className={`tbtn ${!stores.labelingUiStore.suggestionEnabled ? 'tbtn-l1 active' : 'tbtn-l3'}`}
                        onClick={() => {
                            stores.labelingUiStore.suggestionEnabled = false;
                            stores.labelingStore.removeAllSuggestions();
                            labelingSuggestionGenerator.removeAllSuggestions();
                        }}
                    >Off</button>
                </span>
                <button
                    type='button'
                    className='tbtn tbtn-red'
                    title='Confirm all suggested labels'
                    onClick={() => stores.labelingStore.confirmVisibleSuggestions()}
                ><span className='glyphicon icon-only glyphicon-ok'></span></button>
                <ReferenceVideoToolbar />
            </div>
        );
    }
}
