import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import {Theme} from "@radix-ui/themes";

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);
root.render(
    <React.StrictMode>
        <Theme>
            <App/>
        </Theme>
    </React.StrictMode>
);
