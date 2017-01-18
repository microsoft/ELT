// The view that manages the list of classes.

import * as actions from '../../actions/Actions';
import {KeyCode} from '../../stores/dataStructures/types';
import * as stores from '../../stores/stores';
import * as React from 'react';
import {observer} from 'mobx-react';


export interface ClassesListViewState {
    classes?: string[];
    classColors?: string[];
    currentClass?: string;
}

@observer
export class ClassesListView extends React.Component<{}, ClassesListViewState> {
    public refs: {
        [key: string]: Element,
        inputClassName: HTMLInputElement
    };

    constructor(props: {}, context: any) {
        super(props, context);

        this.state = {
            classes: stores.labelingStore.classes,
            classColors: stores.labelingStore.classColors,
            currentClass: stores.labelingUiStore.currentClass
        };
    }


    private addClass(): void {
        const text = this.refs.inputClassName.value.trim();
        if (text.length > 0) {
            stores.labelingStore.addClass(text);
            stores.labelingUiStore.selectClass(text);
        }
        this.refs.inputClassName.value = '';
    }

    protected updateState(): void {
        this.setState({
            classes: stores.labelingStore.classes,
            classColors: stores.labelingStore.classColors
        });
    }

    public render(): JSX.Element {
        let listItems = this.state.classes.map((c, i) => {
            let nameWidget = (<span>{c}</span>);
            if (this.state.currentClass === c && c !== 'IGNORE') {
                nameWidget = (
                    <input
                        type='text'
                        defaultValue={c}
                        onFocus={(e) => {
                            (e.target as HTMLInputElement).select();
                        } }
                        onBlur={(e) => {
                            const v = (e.target as HTMLInputElement).value;
                            stores.labelingStore.renameClass(c, v);
                        } }
                        />
                );
            }
            return (
                <div
                    className={`classes-list-item clearfix ${this.state.currentClass === c ? 'active' : ''}`}
                    key={`class-${i}`}
                    role='button'
                    onClick={ () => {
                        stores.labelingUiStore.selectClass(c);
                    } }
                    >
                    <span className='badge-classname' style={ { backgroundColor: this.state.classColors[i] } }></span>
                    {nameWidget}
                    {
                        c !== 'IGNORE' ? (
                            <span className='pull-right'>
                                <button type='button' className='tbtn tbtn-red tbtn-small' onClick={
                                    () => {
                                        if (confirm(`Are you sure to delete the class '${c}'? '+
                                        'All the labels in this class will be deleted.`)) {
                                            stores.labelingStore.removeClass(c);
                                        }
                                    }
                                }><span className='glyphicon glyphicon-remove icon-only'></span></button>
                            </span>
                        ) : null
                    }
                </div>
            );
        });
        if (listItems.length === 0) {
            listItems = [
                <div className='classes-list-item clearfix' key={'class-none'}>
                    <span>(no class defined) </span>
                </div>
            ];
        }
        return (
            <div className='classes-list-view'>
                <div className='classes-list'>
                    {listItems}
                </div>
                <div className='classes-add'>
                    <input type='text' ref='inputClassName' className='tinput' placeholder='class name'
                        onKeyDown={event => {
                            if (event.keyCode === KeyCode.ENTER) {
                                this.addClass();
                            }
                        } } />{ ' ' }
                    <button type='button' className='tbtn tbtn-l3'
                        onClick={ () => { this.addClass(); } }>Add</button>
                </div>
            </div>
        );
    }
}






export interface InlineClassesListViewState {
    classes?: string[];
    classColors?: string[];
    currentClass?: string;
    active?: boolean;
}


@observer
export class InlineClassesListView extends React.Component<{}, InlineClassesListViewState> {
    public refs: {
        [key: string]: Element,
        wrapper: Element
    };

    constructor(props: {}, context: any) {
        super(props, context);

        this.state = {
            classes: stores.labelingStore.classes,
            classColors: stores.labelingStore.classColors,
            currentClass: stores.labelingUiStore.currentClass,
            active: false
        };
    }


    protected updateState(): void {
        this.setState({
            classes: stores.labelingStore.classes,
            classColors: stores.labelingStore.classColors
        });
    }


    private setActive(): void {
        this.setState({
            active: true
        });
        window.addEventListener(
            'mousedown',
            event => {
                let isInView = false;
                let elem = event.target as Node;
                while (elem) {
                    if (this.refs.wrapper === elem) { isInView = true; }
                    elem = elem.parentNode;
                }
                if (!isInView) {
                    this.setState({ active: false });
                }
            },
            true);
    }

    public render(): JSX.Element {
        return (
            <span className={`inline-classes-list-view ${this.state.active ? 'active' : ''}`}>
                <span className='classname' role='button' onClick={event => this.setActive() }>
                    <span className='badge-classname'
                        style={ { backgroundColor: this.state.classColors[this.state.classes.indexOf(this.state.currentClass)] } }>
                    </span>
                    <span>{this.state.currentClass}</span>
                </span>
                <div ref='wrapper' className='classes-list-view-wrapper' style={ { display: this.state.active ? 'block' : 'none' } }>
                    <ClassesListView />
                </div>
            </span>
        );
    }
}
