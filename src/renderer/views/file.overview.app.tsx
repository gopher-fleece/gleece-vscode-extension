import * as React from 'react';
import { createRoot } from 'react-dom/client';

const App = () => {
	return (
		<div>
			<h1>Hello from React!</h1>
		</div>
	);
};

const rootElement = document.getElementById('root');
if (rootElement) {
	const root = createRoot(rootElement);
	root.render(<App />);
}
