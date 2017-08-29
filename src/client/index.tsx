import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {CApp} from './components/app';
import {Provider} from "react-redux";
import {getStore} from "./store/store";

let appRoot = document.createElement('div');
document.body.appendChild(appRoot);

let appStore = getStore();

ReactDOM.render(
    <Provider store={appStore}>
      <CApp />
    </Provider>,
    appRoot
);
