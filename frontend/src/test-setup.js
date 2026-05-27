import '@testing-library/react/pure';

// jsdom doesn't implement scroll APIs
window.HTMLElement.prototype.scrollTo = () => {};
