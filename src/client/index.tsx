import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './components/app';
import {Provider} from "react-redux";
import {initStore} from "./store/store";

let appRoot = document.createElement('div');
document.body.appendChild(appRoot);

let appStore = initStore();

ReactDOM.render(
    <Provider store={appStore}>
      <App />
    </Provider>,
    appRoot
);
