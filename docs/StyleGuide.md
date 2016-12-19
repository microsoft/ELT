Intelligent Devices UX style guide
====================================================

This is the coding style guide for UX projects. 

Directory hierarchy 
--------------

TODO: after setting up intern project spaces. Include build scripts?


File structure
--------------
Use one file per logical component (one main class per file plus any helpers).

Files should be organized in the following way:
* import statements
* props interface
* state interface
* class definition
    * refs
    * private fields
    * public fields
    * constructors
    * getters/setters
    * lifecycle methods (componentsWillMount, componentsDidMount...)
    * event handlers
    * other methods
    * render

Naming
--------------
All names should be as descriptive as possible. Prefer whole words to abbreviations, especially if those abbreviations could be ambiguous, e.g., prefer `CurrentMousePosition` to `CurrMousePos`

Filenames:  
Use camelCase, e.g., `dataStore.ts`  
Component filenames should match the main component class, e.g., the `dataView.tsx` file should contain a `class DataView`.

Classes, interfaces, and enums:  
Use PascalCase, e.g., `class DataView`. 
Don't use "I" as a prefix for interface names.

Component props and state interfaces:  
Use the same name as the corresponding component followed by "Props" or "State", e.g., `DataViewProps` and `DataViewState` for the `DataView` component.

Methods:  
Use camelCase, e.g., `onDragStart()`, `zoomLevel()`

Member variables:  
Use `_` (underscore) followed by camelCase, e.g., `_zoomLevel`

Getter and setter methods:  
Use the same name as the corresponding member variable, minus the underscore, e.g., `public get zoomLevel()`

Enum values (TODO: double check this):  
Use all caps with `_` (underscore) between words, e.g., `INPUT_DATA_CHANGED`

Event emitters, addListeners and removeListeners:  
Use `private emit<event name>`, `public add<event name>Listener`, `public remove<event name>Listener`

Import statements:  
Only import what you need. If you only need to import one class from a file, use `import {ClassName} from 'path'`. If you need to import more than one class, use `import * as className from 'path'`. Do not import using requires because these will not pick up the interface description from typings.


Types and modifiers
--------------
All methods and member variables should have access modifiers. Always opt for `private` where possible and `public` when necessary.

Always specify types for member variables, e.g., prefer `private _dataFileName : string = "";` to `private _dataFileName = "";`.

There is no need to specify types for local variables.

 `any` types should be avoided.

`refs` should always start with `[key: string]: React.ReactInstance`. All additional refs should also be of type `React.ReactInstance`. For example:

    refs: {
        [key: string]: React.ReactInstance,
        dataView: React.ReactInstance,
    }

Always do type checks and set default values on state variables. e.g., TODO


Miscellaneous styling
-------

Keep lambdas simple e.g., prefer `x => x + x` to `(x) => x + x`.

Open curly braces always go on the same line as whatever necessitates them.

`else` and `else if` goes on a separate line from the closing curly brace.

Use fat arrow syntax `() => {` over `function() {`. The word function shouldn't appear in your code.

Use `let` not `var` for local variables.

Do not export types/functions unless you need to share them across components.

For anything not documented here, consult this guide: https://github.com/Microsoft/TypeScript/wiki/Coding-guidelines


Comments
-------

Only add comments for anything that is not obvious.

TODO statements can be used before checking in to master, e.g., for communicating to code reviewers. No TODOs should be checked in to master.


Interfacing with EMLL
-------

TODO


HTML and CSS
--------

Use bootstrap css as much as possible: http://getbootstrap.com/css/

Add custom styles to `styles.css`

Note that Typescript html code uses `className` not `class` whereas .html files use `class`

