import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './components/app';

let appRoot = document.createElement('div');
document.body.appendChild(appRoot);

ReactDOM.render(
    <App/>,
    appRoot
);
