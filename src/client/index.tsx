import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {Provider} from "react-redux";
import {getStore} from "./store/store";
import {CApp} from "./components/app/app";

let appRoot = document.createElement('div');
document.body.appendChild(appRoot);

let appStore = getStore();

ReactDOM.render(
    <Provider store={appStore}>
      <CApp />
    </Provider>,
    appRoot
);
